import React, { useCallback } from 'react';

import { EnhanceIcon } from '../enhanceIcon';
import { LineVertical } from '../line-vertical';
import { Thumbs } from '../thumbs';

import * as styles from './styles.module.less';

export interface IAiInlineResultProps {
  iconItems: {
    icon: string;
    text: string;
    onClick: () => void;
  }[];
}

export const AiInlineResult = (props: IAiInlineResultProps) => {
  const { iconItems } = props;

  return (
    <div className={styles.ai_inline_result_panel}>
      <div className={styles.side}>
        {iconItems.map(({ icon, text, onClick }, idx) => (
            <EnhanceIcon wrapperClassName={styles.operate_btn} icon={icon} onClick={onClick}>
              <span>{text}</span>
            </EnhanceIcon>
          ))}
      </div>
      <LineVertical height={'60%'} margin={'0px 6px 0 6px'} />
      <div className={styles.side}>
        <Thumbs wrapperClassName={styles.operate_icon} />
      </div>
    </div>
  );
};
