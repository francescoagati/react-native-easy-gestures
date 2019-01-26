import React, { Component } from 'react';
import PropTypes from 'prop-types';
import R from 'ramda';

import { PanResponder, View } from 'react-native';

// Utils
import { angle, distance, distance_x, distance_y, pow2abs } from './utils/math.js';
import { getAngle, getScale, getScaleX, getScaleY, getTouches, isMultiTouch } from './utils/events.js';

const getTanFromDegrees = (degrees) => {
  return Math.tan(degrees * Math.PI / 180);
};

export default class Gestures extends Component {
  static propTypes = {
    children: PropTypes.element,
    // Behavior
    draggable: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.shape({
        x: PropTypes.bool,
        y: PropTypes.bool
      })
    ]),
    rotatable: PropTypes.bool,
    scalable: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.shape({
        min: PropTypes.number,
        max: PropTypes.number
      })
    ]),
    // Styles
    style: PropTypes.object,
    // Callbacks
    onStart: PropTypes.func,
    onChange: PropTypes.func,
    onEnd: PropTypes.func,
    onMultyTouchStart: PropTypes.func,
    onMultyTouchChange: PropTypes.func,
    onMultyTouchEnd: PropTypes.func,
    onRelease: PropTypes.func, // Legacy
    onRotateStart: PropTypes.func,
    onRotateChange: PropTypes.func,
    onRotateEnd: PropTypes.func,
    onScaleStart: PropTypes.func,
    onScaleChange: PropTypes.func,
    onScaleEnd: PropTypes.func
  };

  static defaultProps = {
    children: {},
    // Behavior
    draggable: true || {
      x: true,
      y: false
    },
    rotatable: true,
    scalable: true || {
      min: 0.33,
      max: 2
    },
    // Styles
    style: {
      left: 0,
      top: 0,
      transform: [ { rotate: '0deg' }, { scale: 1 } ]
    },
    // Callbacks
    onStart: () => {},
    onChange: () => {},
    onEnd: () => {},
    onRelease: () => {}, // Legacy

    // New callbacks
    onMultyTouchStart: () => {},
    onMultyTouchChange: () => {},
    onMultyTouchEnd: () => {},
    onRotateStart: () => {},
    onRotateChange: () => {},
    onRotateEnd: () => {},
    onScaleStart: () => {},
    onScaleChange: () => {},
    onScaleEnd: () => {}
  };

  constructor(props) {
    super(props);

    this.state = {
      isMultyTouchingNow: false,
      isRotatingNow: false,
      isScalingNow: false,

      style: {
        ...Gestures.defaultProps.style,
        ...this.props.style
      }
    };
  }

  componentWillMount() {
    this.pan = PanResponder.create({
      onPanResponderGrant: this.onMoveStart,
      onPanResponderMove: this.onMove,
      onPanResponderEnd: this.onMoveEnd,

      onPanResponderTerminate: () => true,
      onShouldBlockNativeResponder: () => true,
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => true,
      onMoveShouldSetPanResponderCapture: (event, { dx, dy }) => dx !== 0 && dy !== 0
    });
  }

  componentDidMount() {
    const { style } = this.state;
    this.prevStyles = style;
    setTimeout(() => {
      this.setViewport();
    }, 0);
  }

  onDrag(event, gestureState) {
    const { initialStyles } = this;
    const { draggable, canDrag, modStyles } = this.props;

    const isObject = R.is(Object, draggable);

    const left = (isObject ? draggable.x : draggable) ? initialStyles.left + gestureState.dx : initialStyles.left;

    const top = (isObject ? draggable.y : draggable) ? initialStyles.top + gestureState.dy : initialStyles.top;

    if (canDrag != null && canDrag({ left: left, top: top, styles: this.dragStyles }) == false) return;

    //if (modStyles != null) modStyles({ left: left, top: top, styles: this.dragStyles })
    /*
 if (left != null) {
 if (left < 0) left = 0;
 styles.left = left;
 }

 if (top != null) {
 if (top < 0) top = 0;
 styles.top = top;
 }
*/

    this.dragStyles = { left, top };
  }

  onRotate = (event) => {
    const { onRotateStart, onRotateChange, rotatable } = this.props;
    const { isRotatingNow, style } = this.state;

    const { initialTouches } = this;

    if (rotatable) {
      const currentAngle = angle(getTouches(event));
      const initialAngle = initialTouches.length > 1 ? angle(initialTouches) : currentAngle;
      const newAngle = currentAngle - initialAngle;
      const diffAngle = this.prevAngle - newAngle;

      this.pinchStyles.transform.push({
        rotate: getAngle(event, style, diffAngle)
      });

      this.prevAngle = newAngle;

      if (!isRotatingNow) {
        onRotateStart(event, style);

        this.setState({ isRotatingNow: true });
      } else {
        onRotateChange(event, style);
      }
    }
  };

  process_scale_x(touches, initialTouches, min, max, style, event) {
    const currentDistance = distance_x(getTouches(event));
    const initialDistance = distance_x(initialTouches);
    const increasedDistance = currentDistance - initialDistance;
    const diffDistance = this.prevDistanceX - increasedDistance;

    //console.log({currentDistance,initialDistance,increasedDistance,diffDistance,prevDistanceX:this.prevDistanceX})

    this.prevDistanceX = increasedDistance;

    const scale = Math.min(Math.max(getScaleX(event, style, diffDistance), min), max);
    return scale;
  }

  process_scale_y(touches, initialTouches, min, max, style, event) {
    const currentDistance = distance_y(getTouches(event));
    const initialDistance = distance_y(initialTouches);
    const increasedDistance = currentDistance - initialDistance;
    const diffDistance = this.prevDistanceY - increasedDistance;
    this.prevDistanceY = increasedDistance;

    const scale = Math.min(Math.max(getScaleY(event, style, diffDistance), min), max);
    return scale;
  }

  //touch1:Array<{locationX:Float,locationY:Float}>
  // const v_diag1 = Math.sqrt(,2);

  calc_vector(touch1, touch2) {
    const vh_degrees = 15;
    const min_movement = 20;

    const tan_v = getTanFromDegrees(90 - vh_degrees);
    const tan_h = getTanFromDegrees(vh_degrees);

    const v1 = Math.abs(touch1[0].pageY - touch1[1].pageY);
    const v2 = Math.abs(touch2[0].pageY - touch2[1].pageY);

    const v_delta = v2 - v1;
    const v_scale = Math.abs(v2 / v1);

    const h1 = Math.abs(touch1[0].pageX - touch1[1].pageX);
    const h2 = Math.abs(touch2[0].pageX - touch2[1].pageX);
    const h_delta = h2 - h1;
    const h_scale = Math.abs(h2 / h1);

    const diag1 = Math.sqrt(v1 * v1 + h1 * h1);
    const diag2 = Math.sqrt(v2 * v2 + h2 * h2);
    const d_delta = diag2 - diag1;
    const d_scale = Math.abs(diag2 / diag1);

    const distance = Math.max(Math.abs(v_delta), Math.abs(h_delta));
    const tan_theta = Math.abs(v_delta / h_delta);

    let rt = {
      small: true,
      direction: 'diagonal',
      scaleD: d_scale,
      scaleX: h_scale,
      scaleY: v_scale,
      debug: { tan_v, tan_h, v1, v2, v_delta, v_scale, h1, h2, h_delta, h_scale, tan_theta, distance }
    };

    if (distance > min_movement) {
      rt.small = false;

      if (tan_theta > tan_v) {
        rt.direction = 'vertical';
      }

      if (tan_theta < tan_h) {
        rt.direction = 'horizontal';
      }
    }

    return rt;
  }

  onScale = (event) => {
    const { onScaleStart, onScaleChange, scalable } = this.props;
    const { isScalingNow, style } = this.state;
    const { initialTouches } = this;

    const isObject = R.is(Object, scalable);

    if (isObject || scalable) {
      const touches = getTouches(event);

      const vector = this.calc_vector(initialTouches, touches);

      let scaleX = vector.scaleD;
      let scaleY = vector.scaleD;

      if (vector.small) {
        this.direction = null;
        scaleX = null;
        scaleY = null;
      } else {
        if (this.direction == null) {
          this.direction = vector.direction;
        }

        if (this.direction == 'vertical') {
          scaleX = null;
          scaleY = vector.scaleY;
        }

        if (this.direction == 'horizontal') {
          scaleY = null;
          scaleX = vector.scaleX;
        }
      }


 if (scaleX) 
 scaleX = scaleX * this.accScaleX;
 else
 scaleX = this.prevScaleX

 if (scaleY) 
 scaleY = scaleY * this.accScaleX;
 else
 scaleY = this.prevScaleY

      //if (scaleX > 1) scaleX = this.prevScaleX;
      //if (scaleY > 1) scaleY = this.prevScaleY;

      const width = this.state.viewport.width * scaleX;
      const height = this.state.viewport.height * scaleY;
      const ar = width / height;

      if (ar < 0.5 || ar > 2) {
        scaleX = this.prevScaleX;
        scaleY = this.prevScaleY;
      }

      this.prevScaleX = scaleX;
      this.prevScaleY = scaleY;

      this.pinchStyles.transform.push({ scaleX: scaleX });
      this.pinchStyles.transform.push({ scaleY: scaleY });

      console.log({ prevScaleX: this.prevScaleX, prevScaleY: this.prevScaleY,scaleX,scaleY,vector });

      if (this.props.log != null)
        this.props.log({
          touches,
          initialTouches,
          calc_vector: vector,
          scaleX,
          scaleY,
          direction: this.direction
        });

      //const currentDistance = distance(getTouches(event));
      //const initialDistance = distance(initialTouches);
      //const increasedDistance = currentDistance - initialDistance;
      //const diffDistance = this.prevDistance - increasedDistance;

      //console.log({ touches, initialTouches, currentDistance, initialDistance, increasedDistance, diffDistance });

      let min = isObject ? scalable.min : 0.33;
      let max = isObject ? scalable.max : 2;

      min = 0.33;
      max = 2;

      //const scale = Math.min(Math.max(getScale(event, style, diffDistance), min), max);

      //custom code for scaleX and scaleY
      //const scaleX = this.process_scale_x(touches,initialTouches,min,max,style,event)
      //const scaleY = this.process_scale_y(touches,initialTouches,min,max,style,event)

      //console.log({
      //currentDistance,
      //initialDistance,
      //increasedDistance,
      //diffDistance,
      //scale,
      //scaleX,
      //scaleY
      //});

      //custom code for scaleX and scaleY
      //this.pinchStyles.transform.push({ scaleX: scaleX });
      //this.pinchStyles.transform.push({ scaleY: scaleY });
      //this.prevDistance = increasedDistance;

      if (!isScalingNow) {
        onScaleStart(event, style);

        this.setState({ isScalingNow: true });
      } else {
        onScaleChange(event, style);
      }
    }
  };

  onMoveStart = (event) => {
    const { style } = this.state;
    const { onMultyTouchStart, onStart } = this.props;

    const touches = getTouches(event);

    this.prevAngle = 0;
    this.prevDistance = 0;
    this.prevDistanceX = 0;
    this.prevDistanceY = 0;
    this.initialTouchesAngle = 0;
    this.pinchStyles = {};
    this.dragStyles = {};
    this.prevStyles = style;

    this.initialTouches = getTouches(event);
    this.initialStyles = style;

    this.direction = null;

    if (!this.accScaleX) this.accScaleX = 1;
    if (!this.accScaleY) this.accScaleY = 1;

    if (!this.prevScaleX) this.prevScaleX = 1;
    if (!this.prevScaleY) this.prevScaleY = 1;

    onStart(event, style);

    if (touches.length > 1) {
      onMultyTouchStart(event, style);

      this.setState({ isMultyTouchingNow: true, drag: true });
    }
  };

  onMove = (event, gestureState) => {
    const { isMultyTouchingNow, style } = this.state;
    const { onChange, onMultyTouchChange } = this.props;

    const { initialTouches } = this;

    const touches = getTouches(event);

    if (touches.length !== initialTouches.length) {
      this.initialTouches = touches;
    } else {
      if (touches.length == 1) this.onDrag(event, gestureState);
      this.onPinch(event);
    }

    if (isMultyTouchingNow) {
      onMultyTouchChange(event, style);
    }

    this.updateStyles();

    onChange(event, style);
  };

  onMoveEnd = (event) => {
    const { isMultyTouchingNow, isRotatingNow, isScalingNow, style } = this.state;
    const {
      onEnd,
      onMultyTouchEnd,
      onRelease, // Legacy
      onRotateEnd,
      onScaleEnd
    } = this.props;

    this.direction = null;

    onEnd(event, style);
    onRelease(event, style); // Legacy

    if (isRotatingNow) {
      onRotateEnd(event, style);
    }

    if (isScalingNow) {
      onScaleEnd(event, style);
    }

    if (isMultyTouchingNow) {
      onMultyTouchEnd(event, style);
    }

    this.accScaleX = this.accScaleX * this.prevScaleX;
    this.accScaleY = this.accScaleY * this.prevScaleY;

    const width = this.state.viewport.width;
    const height = this.state.viewport.height;
    const scaleX = this.prevScaleX;
    const scaleY = this.prevScaleY;

    const final_coords = {
      left: width / 2 * (1 - scaleX),
      top: height / 2 * (1 - scaleY),
      width: width * scaleX,
      height: height * scaleY
    };

    this.setState({
      isRotatingNow: false,
      isScalingNow: false,
      drag: false,
      final_coords: final_coords
    });
  };

  onPinch = (event) => {
    if (isMultiTouch(event)) {
      this.pinchStyles = { transform: [] };

      this.onScale(event);
      this.onRotate(event);
    }
  };

  updateStyles = () => {
    const style = {
      ...this.state.style,
      ...this.dragStyles,
      ...this.pinchStyles
    };

    this.updateNativeStyles(style);
    this.setState({ style });
  };

  updateNativeStyles = (style) => {
    this.view.setNativeProps({ style });
  };

  reset = (callback) => {
    const { left, top, transform } = this.prevStyles;

    this.dragStyles = { left, top };
    this.pinchStyles = { transform };

    this.updateStyles();

    callback(this.prevStyles);
  };

  async setViewport() {
    this.view.measure((x, y, width, height, pageX, pageY) => {
      if (width != 0 && height != 0 && !this.state.viewport) {
        this.setState({ viewport: { width, height } });
        console.log({ width, height });
      }
    });
  }

  render() {
    const { style } = this.state;
    const { children } = this.props;

    return (
      <View>
        <View
          ref={(c) => {
            this.view = c;
          }}
          style={style}
          {...this.pan.panHandlers}
        >
          {children}
        </View>

        {this.state.drag == false ? (
          <View
            style={{
              position: 'absolute',
              top: this.state.final_coords.top,
              left: this.state.final_coords.left,
              width: this.state.final_coords.width,
              height: this.state.final_coords.height,
              borderColor: 'blue',
              borderWidth: 3
            }}
          />
        ) : null}
      </View>
    );
  }
}
