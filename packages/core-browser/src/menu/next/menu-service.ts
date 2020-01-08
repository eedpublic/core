import { CommandRegistry, Disposable, Event, Emitter } from '@ali/ide-core-common';
import { Autowired, Injectable, Optional, INJECTOR_TOKEN, Injector } from '@ali/common-di';

import { ContextKeyChangeEvent, IContextKeyService } from '../../context-key';
import { IMenuItem, isIMenuItem, ISubmenuItem, IMenuRegistry, MenuNode } from './base';
import { MenuId } from './menu-id';
import { AbstractMenuService, IMenu, IMenuNodeOptions, SubmenuItemNode, MenuItemNode } from './menu.interface';

type MenuItemGroup = [string, Array<IMenuItem | ISubmenuItem>];

@Injectable()
export class MenuServiceImpl implements AbstractMenuService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IContextKeyService)
  globalCtxKeyService: IContextKeyService;

  createMenu(id: MenuId, contextKeyService?: IContextKeyService): IMenu {
    return this.injector.get(Menu, [id, contextKeyService || this.globalCtxKeyService]);
  }
}

@Injectable()
class Menu extends Disposable implements IMenu {
  private readonly _onDidChange = new Emitter<IMenu | undefined>();
  get onDidChange(): Event<IMenu | undefined> {
    return this._onDidChange.event;
  }

  private _menuGroups: MenuItemGroup[];
  private _contextKeys: Set<string>;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  constructor(
    @Optional() private readonly id: MenuId,
    @Optional() private readonly contextKeyService: IContextKeyService,
  ) {
    super();
    this._build();

    // rebuild this menu whenever the menu registry reports an
    // event for this MenuId
    this.addDispose(Event.debounce(
      Event.filter(this.menuRegistry.onDidChangeMenu, (menuId) => menuId === this.id),
      () => { },
      50,
    )(this._build, this));

    // when context keys change we need to check if the menu also
    // has changed
    this.addDispose(Event.debounce<ContextKeyChangeEvent, boolean>(
      this.contextKeyService.onDidChangeContext,
      (last, event) => last || event.payload.affectsSome(this._contextKeys),
      50,
    )((e) => e && this._onDidChange.fire(undefined), this));

    this.addDispose(this._onDidChange);
  }

  private _build(): void {

    // reset
    this._menuGroups = [];
    this._contextKeys = new Set();

    let menuItems = this.menuRegistry.getMenuItems(this.id);

    let group: MenuItemGroup | undefined;
    menuItems = menuItems.sort(menuItemsSorter);

    for (const item of menuItems) {
      // group by groupId
      const groupName = item.group || '';
      if (!group || group[0] !== groupName) {
        group = [groupName, []];
        this._menuGroups.push(group);
      }
      group![1].push(item);

      // keep keys for eventing
      this.fillKeysInWhenExpr(this._contextKeys, item.when);

      // 收集 toggledWhen
      if (isIMenuItem(item)) {
        this.fillKeysInWhenExpr(this._contextKeys, item.toggledWhen);
      }

      // 收集 enabledWhen
      if (isIMenuItem(item)) {
        if (item.enabledWhen) {
          this.fillKeysInWhenExpr(this._contextKeys, item.enabledWhen);
        }
      }
    }
    this._onDidChange.fire(this);
  }

  getMenuNodes(config: IMenuNodeOptions = {}): Array<[string, Array<MenuItemNode | SubmenuItemNode>]> {
    const result: [string, Array<MenuItemNode | SubmenuItemNode>][] = [];
    for (const group of this._menuGroups) {
      const [id, items] = group;
      const activeActions: Array<MenuItemNode | SubmenuItemNode> = [];
      for (const item of items) {
        const activeAction = this._getActiveAction(item, config);
        if (activeAction) {
          activeActions.push(activeAction);
        }
      }
      if (activeActions.length > 0) {
        result.push([id, activeActions]);
      }
    }
    return result;
  }

  private _getActiveAction(item: IMenuItem | ISubmenuItem, options: IMenuNodeOptions) {
    // FIXME: 由于缺失比较多的 context key, 因此 CommandPalette 跳过 when 匹配
    if (this.id === MenuId.CommandPalette || this.contextKeyService.match(item.when, options.contextDom)) {
      if (isIMenuItem(item)) {
        // 兼容现有的 Command#isVisible
        const { args = [] } = options;
        const menuCommandDesc = this.menuRegistry.getMenuCommand(item.command);
        const command = this.commandRegistry.getCommand(menuCommandDesc.id);

        const menuCommand = { ...(command || {}), ...menuCommandDesc };
        // 没有 desc 的 command 不展示在 menu 中
        if (!menuCommand.label) {
          return;
        }

        // FIXME: Command.isVisible 待废弃
        // command 存在但是 isVisible 为 false 则跳过
        if (command && !this.commandRegistry.isVisible(menuCommand.id, ...args)) {
          return;
        }

        // 默认为 true, 此项状态皆来自于 Command
        // menu.enabledWhen 的优先级高于 Command.isEnabled
        // 若设置了 menu.enabledWhen 则忽略 Command.isEnabled
        const commandEnablement = command ? this.commandRegistry.isEnabled(menuCommand.id, ...args) : true;
        const disabled = item.enabledWhen !== undefined
          ? !this.contextKeyService.match(item.enabledWhen, options.contextDom)
          : !commandEnablement;

        // menu.toggledWhen 的优先级高于 Command.isToggled
        // 若设置了 menu.toggledWhen 则忽略 Command.isToggled
        const commandToggle = Boolean(command && this.commandRegistry.isToggled(menuCommand.id, ...args));
        const checked = item.toggledWhen !== undefined
          ? this.contextKeyService.match(item.toggledWhen, options.contextDom)
          : commandToggle;

        const action = this.injector.get(MenuItemNode, [menuCommand, options, disabled, checked, item.nativeRole]);
        return action;
      } else {
        // 只有 label 存在值的时候才渲染
        if (item.label) {
          const action = this.injector.get(SubmenuItemNode, [item]);

          return action;
        }
      }
    }
  }

  private fillKeysInWhenExpr(set: Set<string>, when?: string | monaco.contextkey.ContextKeyExpr) {
    const keys = this.contextKeyService.getKeysInWhen(when);
    keys.forEach((key) => {
      set.add(key);
    });
  }
}

function menuItemsSorter(a: IMenuItem, b: IMenuItem): number {
  const aGroup = a.group;
  const bGroup = b.group;

  if (aGroup !== bGroup) {

    // Falsy groups come last
    if (!aGroup) {
      return 1;
    } else if (!bGroup) {
      return -1;
    }

    // 'navigation' group comes first
    if (aGroup === 'navigation') {
      return -1;
    } else if (bGroup === 'navigation') {
      return 1;
    }

    // lexical sort for groups
    const value = aGroup.localeCompare(bGroup);
    if (value !== 0) {
      return value;
    }
  }

  // sort on priority - default is 0
  const aPrio = a.order || 0;
  const bPrio = b.order || 0;
  if (aPrio < bPrio) {
    return -1;
  } else if (aPrio > bPrio) {
    return 1;
  }

  return 0;
  // TODO: 临时先禁用掉这里的排序
  // return Command.compareCommands(a.command, b.command);
}
