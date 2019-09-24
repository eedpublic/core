import * as React from 'react';
import { IMenu } from '@ali/ide-core-browser/lib/menu/next/menu-service';
import { splitMenuItems } from '@ali/ide-core-browser/lib/menu/next/menu-util';
import { MenuNode } from '@ali/ide-core-browser/lib/menu/next/base';
import { TitleActionList } from '@ali/ide-core-browser/lib/components/actions';
import { useDisposable } from '@ali/ide-core-browser';

import { ISCMResource, ISCMResourceGroup } from '../../common';
import { SCMMenus } from '../scm-menu';

export const SCMActionBar: React.FC<{
  context: ISCMResourceGroup | ISCMResource;
  menuService: SCMMenus;
  resourceGroup: ISCMResourceGroup;
}> = ({ menuService, resourceGroup, context }) => {
  const [menuConfig, setMenuConfig] = React.useState<MenuNode[]>([]);

  useDisposable(() => {
    const menus = menuService.getResourceInlineActions(resourceGroup);
    updateMenuConfig(menus);

    function updateMenuConfig(menus: IMenu) {
      const menuNodes = menus.getMenuNodes();
      // fixme: 类型问题
      const [navActions] = splitMenuItems(menuNodes, 'inline');
      setMenuConfig(navActions);
    }

    return [
      menus,
      menus.onDidChange(() => {
        updateMenuConfig(menus);
      }),
    ];
  }, [ menuService, resourceGroup ]);

  return (
    <TitleActionList nav={menuConfig} context={context} />
  );
};
