import React, { Component } from 'react';
import PropTypes from 'prop-types';
import R from 'ramda';

import { PanResponder, View, Text } from 'react-native';

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

    this.initial = props.initial;
    if (props.inner) this.inner = props.inner;
    else this.inner = props.initial;

    let moveX = 0;
    let moveY = 0;

    let scaleX = 1;
    let scaleY = 1;

    if (this.transform) {
      moveX = this.transform.moveX;
      moveY = this.transform.moveY;
      scaleX = this.transform.scaleX;
      scaleY = this.transform.scaleY;
    }

    this.transform = {
      scaleX: scaleX,
      scaleY: scaleY,
      moveX: moveX,
      moveY: moveY,
      dx: 0,
      dy: 0
    };

    const startCoords = this.cropBoxCoordinates({});

    console.log({ startCoords, initial: this.initial, transform: this.transform });

    this.state = {
      startCoords: startCoords,
      isMultyTouchingNow: false,
      isRotatingNow: false,
      isScalingNow: false,
      keyCropComponent: Date.now(),
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
    //setTimeout(() => {
    //  this.setViewport();
    //}, 0);
  }

  onDrag(event, gestureState) {
    const { initialStyles } = this;
    const { draggable, canDrag, modStyles } = this.props;

    const isObject = R.is(Object, draggable);

    let dx = gestureState.dx;
    let dy = gestureState.dy;

    let moveX = this.transform.moveX + dx;
    let moveY = this.transform.moveY + dy;

    const coords = this.cropBoxCoordinates({ moveX: moveX, moveY: moveY });

    if (coords.left < this.initial.left || coords.right > this.initial.right) {
      dx = this.transform.dx;
    }

    if (coords.top < this.initial.top || coords.bottom > this.initial.bottom) {
      dy = this.transform.dy;
    }

    let left = initialStyles.left + dx;
    let top = initialStyles.top + dy;

    //const left = (isObject ? draggable.x : draggable) ? initialStyles.left + gestureState.dx : initialStyles.left;
    //const top = (isObject ? draggable.y : draggable) ? initialStyles.top + gestureState.dy : initialStyles.top;

    this.transform.dx = dx;
    this.transform.dy = dy;

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

      if (!scaleX) scaleX = this.transform.scaleX;
      if (!scaleY) scaleY = this.transform.scaleY;

      const coords = this.cropBoxCoordinates({ scaleX: scaleX, scaleY: scaleY });

      if (coords.ar < 0.5 || coords.ar > 2) {
        scaleX = this.transform.scaleX;
        scaleY = this.transform.scaleY;
      }

          if (coords.left < this.initial.left || coords.right > this.initial.right) {
        scaleX = this.transform.scaleX;
      }

      if (coords.top < this.initial.top || coords.bottom > this.initial.bottom) {
        scaleY = this.transform.scaleY;
      }

      this.transform.scaleX = scaleX;
      this.transform.scaleY = scaleY;

      this.pinchStyles.transform.push({ scaleX: scaleX });
      this.pinchStyles.transform.push({ scaleY: scaleY });

      if (this.props.log != null)
        this.props.log({
          touches,
          initialTouches,
          calc_vector: vector,
          scaleX,
          scaleY,
          direction: this.direction
        });

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

    this.transform.dx = 0;
    this.transform.dy = 0;

    console.log(this.initial);

    //if (!this.accScaleX) this.accScaleX = 1;
    //if (!this.accScaleY) this.accScaleY = 1;

    onStart(event, style);

    if (touches.length > 1) {
      onMultyTouchStart(event, style);

      this.setState({ isMultyTouchingNow: true, drag: true, startCoords: null });
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

  /*  cropBoxCoords() {
    this.coords = {
      left: this.initial.left + this.transform.moveX + this.initial.width / 2 * (1 - this.transform.scaleX),
      top: this.initial.top + this.transform.moveY + this.initial.height / 2 * (1 - this.transform.scaleY),
      width: this.initial.width * this.transform.scaleX,
      height: this.initial.height * this.transform.scaleY
    };
  }
*/

  __safe__cropBoxCoordinates({ scaleX, scaleY, moveX, moveY }) {
    scaleX = scaleX ? scaleX : this.transform.scaleX;
    scaleY = scaleY ? scaleY : this.transform.scaleY;
    moveX = moveX ? moveX : this.transform.moveX;
    moveY = moveY ? moveY : this.transform.moveY;

    const left = this.initial.left + moveX + this.initial.width / 2 * (1 - scaleX);
    const top = this.initial.top + moveY + this.initial.height / 2 * (1 - scaleY);

    const width = this.initial.width * scaleX;
    const height = this.initial.height * scaleY;

    return {
      left: left,
      right: left + width,
      top: top,
      bottom: top + height,
      width: width,
      height: height,
      ar: width / height
    };
  }

  cropBoxCoordinates({ scaleX, scaleY, moveX, moveY }) {
    scaleX = scaleX ? scaleX : this.transform.scaleX;
    scaleY = scaleY ? scaleY : this.transform.scaleY;
    moveX = moveX ? moveX : this.transform.moveX;
    moveY = moveY ? moveY : this.transform.moveY;

    const left = this.inner.left + moveX + this.inner.width / 2 * (1 - scaleX);
    const top = this.inner.top + moveY + this.inner.height / 2 * (1 - scaleY);

    const width = this.inner.width * scaleX;
    const height = this.inner.height * scaleY;

    return {
      left: left,
      right: left + width,
      top: top,
      bottom: top + height,
      width: width,
      height: height,
      ar: width / height
    };
  }

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

    this.transform.moveX += this.transform.dx;
    this.transform.moveY += this.transform.dy;

    //this.cropBoxCoords();

    //console.log({coords:this.coords,initial:this.initial,transform:this.transform})
    const finalCoords = this.cropBoxCoordinates({});

    onEnd(event, style);
    onRelease(event, style); // Legacy

    if (isRotatingNow) {
      onRotateEnd(event, style);
    }

    if (isScalingNow) {
      onScaleEnd(event, style, finalCoords);
    }

    if (isMultyTouchingNow) {
      onMultyTouchEnd(event, style);
    }

    this.setState({
      isRotatingNow: false,
      isScalingNow: false,
      drag: false,
      final_coords: finalCoords,
      keyCropComponent: Date.now()
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
    setTimeout(() => {
      if (!this.initial) {
        if (this.view) {
          this.view.measure((x, y, width, height, pageX, pageY) => {
            if (width != 0 && height != 0 && !this.state.viewport) {
              this.initial = {
                top: x,
                bottom: y + height,
                left: y,
                right: x + width,
                width: width,
                height: height
              };

              this.setState({ viewport: { width, height } });
              //console.log({ width, height, x, y });
            }
          });
        }
      } else {
        this.state.viewport = { width: this.initial.width, height: this.initial.height };
      }
    }, 0);
  }

  render() {
    const { style } = this.state;
    const { children } = this.props;

    return (
      <View>
        <View
          key={this.state.keyCropComponent}
          ref={(c) => {
            this.view = c;
            this.setViewport();
          }}
          style={[ style ]}
          {...this.pan.panHandlers}
        >
          {children}
        </View>

        {this.state.startCoords ? (
          <View
            style={{
              position: 'absolute',
              top: this.state.startCoords.top,
              left: this.state.startCoords.left,
              width: this.state.startCoords.width,
              height: this.state.startCoords.height,
              borderColor: 'red',
              borderWidth: 3
            }}
          />
        ) : null}

        {1 == 2 ? (
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
