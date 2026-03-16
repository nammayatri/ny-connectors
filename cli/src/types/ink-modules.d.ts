// Type declarations for ink-related modules without type definitions

declare module 'ink-text-input' {
  import { Component } from 'react';
  
  interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    focus?: boolean;
    mask?: string;
    showCursor?: boolean;
    highlightPastedText?: boolean;
    onSubmit?: (value: string) => void;
  }
  
  export default class TextInput extends Component<TextInputProps> {}
}

declare module 'ink-spinner' {
  import { Component } from 'react';
  
  type SpinnerType = 
    | 'dots' | 'dots2' | 'dots3' | 'dots4' | 'dots5' | 'dots6' | 'dots7' | 'dots8' | 'dots9' | 'dots10' | 'dots11' | 'dots12'
    | 'line' | 'line2' | 'pipe' | 'star' | 'star2' | 'flip' | 'hamburger' | 'growVertical' | 'growHorizontal'
    | 'balloon' | 'balloon2' | 'noise' | 'bounce' | 'boxBounce' | 'boxBounce2' | 'triangle'
    | 'arc' | 'circle' | 'squareCorners' | 'circleQuarters' | 'circleHalves' | 'squish' | 'toggle'
    | 'toggle2' | 'toggle3' | 'toggle4' | 'toggle5' | 'toggle6' | 'toggle7' | 'toggle8' | 'toggle9' | 'toggle10'
    | 'toggle11' | 'toggle12' | 'toggle13' | 'arrow' | 'arrow2' | 'arrow3' | 'bouncingBar' | 'bouncingBall'
    | 'clock' | 'earth' | 'moon' | 'runner' | 'pong' | 'shark' | 'dqpb';
  
  interface SpinnerProps {
    type?: SpinnerType;
  }
  
  export default class Spinner extends Component<SpinnerProps> {}
}

declare module 'ink-select-input' {
  import { Component } from 'react';
  
  interface SelectInputItem {
    label: string;
    value: string;
    key?: string;
  }
  
  interface SelectInputProps {
    items: SelectInputItem[];
    onSelect: (item: SelectInputItem) => void;
    focus?: boolean;
    initialIndex?: number;
    limit?: number;
    indicatorComponent?: Component;
    itemComponent?: Component;
  }
  
  export default class SelectInput extends Component<SelectInputProps> {}
}
