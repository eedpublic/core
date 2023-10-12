import * as React from 'react';
import { Avatar } from 'react-chat-elements';

import { AppConfig, getIcon, useInjectable, SlotRenderer } from '@opensumi/ide-core-browser';
import { Button, Icon, Input } from '@opensumi/ide-core-browser/lib/components';
import { InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { CommandService } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IconMenuBar } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.view';

import { AI_RUN_DEBUG_COMMANDS } from '../../../../common/command';

import * as styles from './menu-bar.module.less';
import { AiMenubarService } from './menu-bar.service';

export const AiMenuBarView = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const aiMenubarService = useInjectable<AiMenubarService>(AiMenubarService);
  const appConfig = useInjectable<AppConfig>(AppConfig);

  const extraTopMenus = React.useMemo(() => layoutService.getExtraTopMenu(), [layoutService]);

  const handleRun = () => {
    commandService.executeCommand(AI_RUN_DEBUG_COMMANDS.id);
  };

  const handleRightPanel = () => {
    aiMenubarService.toggleRightPanel();
  };

  const MENUBAR_HEIGHT = React.useMemo(
    () => appConfig.layoutViewSize?.MENUBAR_HEIGHT || LAYOUT_VIEW_SIZE.MENUBAR_HEIGHT,
    [appConfig],
  );

  return (
    <div id={VIEW_CONTAINERS.MENUBAR} className={styles.menu_bar_view} style={{ height: MENUBAR_HEIGHT }}>
      <div className={styles.container}>
        <div className={styles.left}>
          <IconMenuBar />
          <div className={styles.top_menus_bar}>
            <InlineMenuBar menus={extraTopMenus} className={styles.extra_top_icon} />
          </div>
        </div>
        <div className={styles.center}>
          <div className={styles.run}>
            <Button size={'large'} onClick={handleRun} className={styles.btn}>
              <Icon className={getIcon('caret-right')} /> 运行
            </Button>
          </div>
        </div>
        <div className={styles.right}>
          <SlotRenderer slot='ai-action' flex={1} overflow={'initial'} />
          <div className={styles.input}>
            <Input
              className={styles.input_wrapper}
              width={'100%'}
              addonBefore={<Icon style={{ color: '#ffffff1f' }} className={getIcon('search')} />}
              placeholder='请搜索并选择指令'
              // onFocus={handleSelectFocus}
            ></Input>
          </div>
          <div className={styles.ai_switch} onClick={handleRightPanel}>
            <Icon className={getIcon('magic-wand')} />
          </div>
        </div>
      </div>
    </div>
  );
};