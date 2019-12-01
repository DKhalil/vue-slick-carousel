import json2mq from 'json2mq'

import {
  cloneVNode,
  mergeVNodeData,
  setVNodeData,
  getStyle,
} from '@/vNodeUtils'
import { canUseDOM, filterUndefined } from '@/innerSliderUtils'
import { props, defaultValues } from '@/defaultProps'
import InnerSlider from '@/InnerSlider'

const enquire = canUseDOM() && require('enquire.js')

export default {
  name: 'VueSlickCarousel',
  components: {
    InnerSlider,
  },
  inheritAttrs: false,
  props,
  data() {
    return {
      breakpoint: null,
    }
  },
  computed: {
    settings() {
      const props = filterUndefined(this.$props)
      let settings
      let newProps

      if (this.breakpoint) {
        newProps = this.responsive.filter(
          resp => resp.breakpoint === this.breakpoint,
        )
        settings =
          newProps[0].settings === 'unslick'
            ? 'unslick'
            : {
                ...defaultValues,
                ...props,
                ...newProps[0].settings,
              }
      } else {
        settings = { ...defaultValues, ...props }
      }

      // force scrolling by one if centerMode is on
      if (settings.centerMode) {
        if (
          settings.slidesToScroll > 1 &&
          process.env.NODE_ENV !== 'production'
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `slidesToScroll should be equal to 1 in centerMode, you are using ${settings.slidesToScroll}`,
          )
        }
        settings.slidesToScroll = 1
      }
      // force showing one slide and scrolling by one if the fade mode is on
      if (settings.fade) {
        if (
          settings.slidesToShow > 1 &&
          process.env.NODE_ENV !== 'production'
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `slidesToShow should be equal to 1 when fade is true, you're using ${settings.slidesToShow}`,
          )
        }
        if (
          settings.slidesToScroll > 1 &&
          process.env.NODE_ENV !== 'production'
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `slidesToScroll should be equal to 1 when fade is true, you're using ${settings.slidesToScroll}`,
          )
        }
        settings.slidesToShow = 1
        settings.slidesToScroll = 1
      }

      // rows and slidesPerRow logic is handled here
      if (
        settings.variableWidth &&
        (settings.rows > 1 || settings.slidesPerRow > 1)
      ) {
        // eslint-disable-next-line no-console
        console.warn(
          `variableWidth is not supported in case of rows > 1 or slidesPerRow > 1`,
        )
        settings.variableWidth = false
      }

      return settings
    },
    update() {
      // Read props that need to be listened for changes.
      Object.keys(this.$props).forEach(key => this[key])
      // Return a different value each time. `Date.now()` is not guaranteed to be unique.
      return (this.updateSwitch = !this.updateSwitch)
    },
  },
  watch: {
    update() {
      this.onPropUpdated()
    },
  },
  created() {
    this.makeBreakpoints()
  },
  beforeDestroy() {
    this.clearBreakpoints()
  },
  methods: {
    slickPrev() {
      this.$refs.innerSlider.slickPrev()
    },
    slickNext() {
      this.$refs.innerSlider.slickNext()
    },
    slickGoTo(slide, dontAnimate = false) {
      this.$refs.innerSlider.slickGoTo(slide, dontAnimate)
    },
    slickPause() {
      this.$refs.innerSlider.pause('paused')
    },
    slickPlay() {
      this.$refs.innerSlider.autoPlay('play')
    },
    onPropUpdated() {
      this.clearBreakpoints()
      this.makeBreakpoints()
    },
    clearBreakpoints() {
      this.responsiveMediaHandlers.forEach(obj =>
        enquire.unregister(obj.query, obj.handler),
      )
      this.responsiveMediaHandlers = []
    },
    media(query, handler) {
      // javascript handler for  css media query
      // when not using server side rendering
      if (!canUseDOM()) {
        return
      }

      enquire.register(query, handler)
      this.responsiveMediaHandlers.push({ query, handler })
    },
    makeBreakpoints() {
      this.responsiveMediaHandlers = []

      // handles responsive breakpoints
      if (this.responsive) {
        let breakpoints = this.responsive.map(breakpt => breakpt.breakpoint)
        // sort them in increasing order of their numerical value
        breakpoints.sort((x, y) => x - y)

        breakpoints.forEach((breakpoint, index) => {
          // media query for each breakpoint
          const mediaQuery = json2mq({
            minWidth: index === 0 ? 0 : breakpoints[index - 1] + 1,
            maxWidth: breakpoint,
          })
          this.media(mediaQuery, () => {
            this.breakpoint = breakpoint
          })
        })

        // Register media query for full screen. Need to support resize from small to large
        // convert javascript object to media query string
        const query = json2mq({
          minWidth: breakpoints.slice(-1)[0],
        })
        this.media(query, () => {
          this.breakpoint = null
        })
      }
    },
  },
  render() {
    const { settings } = this
    let children = this.$slots.default || []
    children = children.filter(child => !!child.tag)
    let newChildren = []
    let currentWidth = null
    for (
      let i = 0;
      i < children.length;
      i += settings.rows * settings.slidesPerRow
    ) {
      let newSlide = []
      for (
        let j = i;
        j < i + settings.rows * settings.slidesPerRow;
        j += settings.slidesPerRow
      ) {
        let row = []
        for (let k = j; k < j + settings.slidesPerRow; k += 1) {
          if (settings.variableWidth && getStyle(children[k])) {
            currentWidth = getStyle(children[k]).width
          }
          if (k >= children.length) break
          let clonedVNode = cloneVNode(children[k])
          setVNodeData(clonedVNode, 'key', 100 * i + 10 * j + k)
          mergeVNodeData(clonedVNode, 'attrs', { tabIndex: -1 })
          mergeVNodeData(clonedVNode, 'style', {
            width: `${100 / settings.slidesPerRow}%`,
            display: 'inline-block',
          })
          row.push(clonedVNode)
        }
        newSlide.push(<div key={10 * i + j}>{row}</div>)
      }
      if (settings.variableWidth) {
        newChildren.push(
          <div key={i} style={{ width: currentWidth }}>
            {newSlide}
          </div>,
        )
      } else {
        newChildren.push(<div key={i}>{newSlide}</div>)
      }
    }

    if (settings === 'unslick') {
      return <div class="regular slider">{newChildren}</div>
    } else if (newChildren.length <= settings.slidesToShow) {
      settings.unslick = true
    }

    return (
      <InnerSlider ref="innerSlider" {...{ props: settings }}>
        {newChildren}
      </InnerSlider>
    )
  },
}
