import * as React from 'react';
import { Avatar } from 'react-chat-elements';

import { AI_RUN_DEBUG_COMMANDS } from '@opensumi/ide-ai-native/lib/common/command';
import { AppConfig, getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Button, Icon, Input } from '@opensumi/ide-core-browser/lib/components';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { CommandService } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IconMenuBar } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.view';

import * as styles from './menu-bar.module.less';

export const AiMenuBarView = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const appConfig = useInjectable<AppConfig>(AppConfig);

  const [latestWidth, setLatestWidth] = React.useState<number>(0);

  const handleRun = () => {
    commandService.executeCommand(AI_RUN_DEBUG_COMMANDS.id);
  };

  const handleRightPanel = () => {
    /**
     * 这里先这样处理，暂时没找到原因
     */
    const domID = 'ai_chat_panel';
    const chatPanel = document.querySelector(`#${domID}`)?.parentElement?.parentElement;

    if (chatPanel) {
      let preWidth: number | string = chatPanel.style.width;
      preWidth = parseInt(preWidth, 10);
      setLatestWidth(preWidth);

      if (preWidth !== 0) {
        chatPanel.style.width = '0px';
      } else {
        chatPanel.style.width = latestWidth + 'px';
      }
    }
  };

  const MENUBAR_HEIGHT = React.useMemo(
    () => appConfig.layoutViewSize?.MENUBAR_HEIGHT || LAYOUT_VIEW_SIZE.MENUBAR_HEIGHT,
    [appConfig],
  );

  // quick-open-overlay
  return (
    <div id={VIEW_CONTAINERS.MENUBAR} className={styles.menu_bar_view} style={{ height: MENUBAR_HEIGHT }}>
      {/* <span className={styles.menu_bar_logo} /> */}
      <div className={styles.container}>
        <div className={styles.left}>
          <IconMenuBar />
        </div>
        <div className={styles.center}>
          <div className={styles.run}>
            <Button size={'large'} onClick={handleRun} className={styles.btn}>
              <Icon className={getIcon('caret-right')} /> 运行
            </Button>
          </div>
        </div>
        <div className={styles.right}>
          <div className={styles.input}>
            <Input
              className={styles.input_wrapper}
              width={'100%'}
              addonBefore={<Icon style={{ color: '#ffffff1f' }} className={getIcon('search')} />}
              placeholder='请搜索并选择指令'
              // onFocus={handleSelectFocus}
            ></Input>
          </div>
          <div className={styles.ai_switch}>
            {/* <Icon className={getIcon('search')} onClick={handleRightPanel}/> */}
            <div
              style={{
                cursor: 'pointer',
              }}
              onClick={handleRightPanel}
            >
              <Avatar
                src={'https://mdn.alipayobjects.com/huamei_htww6h/afts/img/A*6Y9PQp_rk7QAAAAAAAAAAAAADhl8AQ/original'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
