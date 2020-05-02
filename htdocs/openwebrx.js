/*

	This file is part of OpenWebRX,
	an open-source SDR receiver software with a web UI.
	Copyright (c) 2013-2015 by Andras Retzler <randras@sdr.hu>
	Copyright (c) 2019-2020 by Jakob Ketterl <dd5jfk@darc.de>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

"""

*/

is_firefox = navigator.userAgent.indexOf("Firefox") >= 0;

var bandwidth;
var center_freq;
var fft_size;
var fft_compression = "none";
var fft_codec;
var waterfall_setup_done = 0;
var secondary_fft_size;
var rx_photo_state = 1;

function e(what) {
    return document.getElementById(what);
}

var rx_photo_height;

function init_rx_photo() {
    var clip = e("webrx-top-photo-clip");
    rx_photo_height = clip.clientHeight;
    clip.style.maxHeight = rx_photo_height + "px";

    $.extend($.easing, {
        easeOutCubic:function(x) {
            return 1 - Math.pow( 1 - x, 3 );
        }
    });

    window.setTimeout(function () {
        $('#webrx-rx-photo-title').animate({opacity: 0}, 500);
    }, 1000);
    window.setTimeout(function () {
        $('#webrx-rx-photo-desc').animate({opacity: 0}, 500);
    }, 1500);
    window.setTimeout(function () {
        close_rx_photo()
    }, 2500);
    $('#webrx-top-container').find('.openwebrx-photo-trigger').click(toggle_rx_photo);
}

var dont_toggle_rx_photo_flag = 0;

function dont_toggle_rx_photo() {
    dont_toggle_rx_photo_flag = 1;
}

function toggle_rx_photo() {
    if (dont_toggle_rx_photo_flag) {
        dont_toggle_rx_photo_flag = 0;
        return;
    }
    if (rx_photo_state) close_rx_photo();
    else open_rx_photo()
}

function close_rx_photo() {
    rx_photo_state = 0;
    $('#webrx-top-photo-clip').animate({maxHeight: 67}, {duration: 1000, easing: 'easeOutCubic'});
    e("openwebrx-rx-details-arrow-down").style.display = "block";
    e("openwebrx-rx-details-arrow-up").style.display = "none";
}

function open_rx_photo() {
    rx_photo_state = 1;
    e("webrx-rx-photo-desc").style.opacity = 1;
    e("webrx-rx-photo-title").style.opacity = 1;
    $('#webrx-top-photo-clip').animate({maxHeight: rx_photo_height}, {duration: 1000, easing: 'easeOutCubic'});
    e("openwebrx-rx-details-arrow-down").style.display = "none";
    e("openwebrx-rx-details-arrow-up").style.display = "block";
}

function updateVolume() {
    audioEngine.setVolume(parseFloat(e("openwebrx-panel-volume").value) / 100);
}

function toggleMute() {
    if (mute) {
        mute = false;
        e("openwebrx-mute-on").id = "openwebrx-mute-off";
        e("openwebrx-mute-img").src = "static/gfx/openwebrx-speaker.png";
        e("openwebrx-panel-volume").disabled = false;
        e("openwebrx-panel-volume").style.opacity = 1.0;
        e("openwebrx-panel-volume").value = volumeBeforeMute;
    } else {
        mute = true;
        e("openwebrx-mute-off").id = "openwebrx-mute-on";
        e("openwebrx-mute-img").src = "static/gfx/openwebrx-speaker-muted.png";
        e("openwebrx-panel-volume").disabled = true;
        e("openwebrx-panel-volume").style.opacity = 0.5;
        volumeBeforeMute = e("openwebrx-panel-volume").value;
        e("openwebrx-panel-volume").value = 0;
    }

    updateVolume();
}

function zoomInOneStep() {
    zoom_set(zoom_level + 1);
}

function zoomOutOneStep() {
    zoom_set(zoom_level - 1);
}

function zoomInTotal() {
    zoom_set(zoom_levels.length - 1);
}

function zoomOutTotal() {
    zoom_set(0);
}

function setSquelchToAuto() {
    e("openwebrx-panel-squelch").value = (getLogSmeterValue(smeter_level) + 10).toString();
    updateSquelch();
}

function updateSquelch() {
    var sliderValue = parseInt($("#openwebrx-panel-squelch").val());
    var demod = $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator();
    if (demod) demod.setSquelch(sliderValue);
}

var waterfall_min_level;
var waterfall_max_level;
var waterfall_min_level_default;
var waterfall_max_level_default;
var waterfall_colors;
var waterfall_auto_level_margin;

function updateWaterfallColors(which) {
    var wfmax = e("openwebrx-waterfall-color-max");
    var wfmin = e("openwebrx-waterfall-color-min");
    if (parseInt(wfmin.value) >= parseInt(wfmax.value)) {
        if (!which) wfmin.value = (parseInt(wfmax.value) - 1).toString();
        else wfmax.value = (parseInt(wfmin.value) + 1).toString();
    }
    waterfall_min_level = parseInt(wfmin.value);
    waterfall_max_level = parseInt(wfmax.value);
}

function waterfallColorsDefault() {
    waterfall_min_level = waterfall_min_level_default;
    waterfall_max_level = waterfall_max_level_default;
    e("openwebrx-waterfall-color-min").value = waterfall_min_level.toString();
    e("openwebrx-waterfall-color-max").value = waterfall_max_level.toString();
}

function waterfallColorsAuto() {
    e("openwebrx-waterfall-color-min").value = (waterfall_measure_minmax_min - waterfall_auto_level_margin.min).toString();
    e("openwebrx-waterfall-color-max").value = (waterfall_measure_minmax_max + waterfall_auto_level_margin.max).toString();
    updateWaterfallColors(0);
}

function setSmeterRelativeValue(value) {
    if (value < 0) value = 0;
    if (value > 1.0) value = 1.0;
    var bar = e("openwebrx-smeter-bar");
    var outer = e("openwebrx-smeter-outer");
    bar.style.width = (outer.offsetWidth * value).toString() + "px";
    var bgRed = "linear-gradient(to top, #ff5939 , #961700)";
    var bgGreen = "linear-gradient(to top, #22ff2f , #008908)";
    var bgYellow = "linear-gradient(to top, #fff720 , #a49f00)";
    bar.style.background = (value > 0.9) ? bgRed : ((value > 0.7) ? bgYellow : bgGreen);
}

function setSquelchSliderBackground(val) {
    var $slider = $('#openwebrx-panel-squelch');
    var min = Number($slider.attr('min'));
    var max = Number($slider.attr('max'));
    var sliderPosition = $slider.val();
    var relative = (val - min) / (max - min);
    // use a brighter color when squelch is open
    var color = val >= sliderPosition ? '#22ff2f' : '#008908';
    // we don't use the gradient, but separate the colors discretely using css tricks
    var style = 'linear-gradient(90deg, ' + color + ', ' + color + ' ' + relative * 100 + '%, #B6B6B6 ' + relative * 100 + '%)';
    $slider.css('--track-background', style);
}

function getLogSmeterValue(value) {
    return 10 * Math.log10(value);
}

function getLinearSmeterValue(db_value) {
    return Math.pow(10, db_value / 10);
}

function setSmeterAbsoluteValue(value) //the value that comes from `csdr squelch_and_smeter_cc`
{
    var logValue = getLogSmeterValue(value);
    setSquelchSliderBackground(logValue);
    var lowLevel = waterfall_min_level - 20;
    var highLevel = waterfall_max_level + 20;
    var percent = (logValue - lowLevel) / (highLevel - lowLevel);
    setSmeterRelativeValue(percent);
    e("openwebrx-smeter-db").innerHTML = logValue.toFixed(1) + " dB";
}

function typeInAnimation(element, timeout, what, onFinish) {
    if (!what) {
        onFinish();
        return;
    }
    element.innerHTML += what[0];
    window.setTimeout(function () {
        typeInAnimation(element, timeout, what.substring(1), onFinish);
    }, timeout);
}


// ========================================================
// ================  DEMODULATOR ROUTINES  ================
// ========================================================

function getDemodulators() {
    return [
        $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator()
    ].filter(function(d) {
        return !!d;
    });
};

function mkenvelopes(visible_range) //called from mkscale
{
    var demodulators = getDemodulators();
    scale_ctx.clearRect(0, 0, scale_ctx.canvas.width, 22); //clear the upper part of the canvas (where filter envelopes reside)
    for (var i = 0; i < demodulators.length; i++) {
        demodulators[i].envelope.draw(visible_range);
    }
    if (demodulators.length) {
        var bandpass = demodulators[0].getBandpass()
        secondary_demod_waterfall_set_zoom(bandpass.low_cut, bandpass.high_cut);
    }
}

function waterfallWidth() {
    return $('body').width();
}


// ========================================================
// ===================  SCALE ROUTINES  ===================
// ========================================================

var scale_ctx;
var scale_canvas;

function scale_setup() {
    scale_canvas = e("openwebrx-scale-canvas");
    scale_ctx = scale_canvas.getContext("2d");
    scale_canvas.addEventListener("mousedown", scale_canvas_mousedown, false);
    scale_canvas.addEventListener("mousemove", scale_canvas_mousemove, false);
    scale_canvas.addEventListener("mouseup", scale_canvas_mouseup, false);
    resize_scale();
    var frequency_container = e("openwebrx-frequency-container");
    frequency_container.addEventListener("mousemove", frequency_container_mousemove, false);
}

var scale_canvas_drag_params = {
    mouse_down: false,
    drag: false,
    start_x: 0,
    key_modifiers: {shiftKey: false, altKey: false, ctrlKey: false}
};

function scale_canvas_mousedown(evt) {
    scale_canvas_drag_params.mouse_down = true;
    scale_canvas_drag_params.drag = false;
    scale_canvas_drag_params.start_x = evt.pageX;
    scale_canvas_drag_params.key_modifiers.shiftKey = evt.shiftKey;
    scale_canvas_drag_params.key_modifiers.altKey = evt.altKey;
    scale_canvas_drag_params.key_modifiers.ctrlKey = evt.ctrlKey;
    evt.preventDefault();
}

function scale_offset_freq_from_px(x, visible_range) {
    if (typeof visible_range === "undefined") visible_range = get_visible_freq_range();
    return (visible_range.start + visible_range.bw * (x / waterfallWidth())) - center_freq;
}

function scale_canvas_mousemove(evt) {
    var event_handled = false;
    var i;
    var demodulators = getDemodulators();
    if (scale_canvas_drag_params.mouse_down && !scale_canvas_drag_params.drag && Math.abs(evt.pageX - scale_canvas_drag_params.start_x) > canvas_drag_min_delta)
    //we can use the main drag_min_delta thing of the main canvas
    {
        scale_canvas_drag_params.drag = true;
        //call the drag_start for all demodulators (and they will decide if they're dragged, based on X coordinate)
        for (i = 0; i < demodulators.length; i++) event_handled |= demodulators[i].envelope.drag_start(evt.pageX, scale_canvas_drag_params.key_modifiers);
        scale_canvas.style.cursor = "move";
    }
    else if (scale_canvas_drag_params.drag) {
        //call the drag_move for all demodulators (and they will decide if they're dragged)
        for (i = 0; i < demodulators.length; i++) event_handled |= demodulators[i].envelope.drag_move(evt.pageX);
        if (!event_handled) demodulators[0].set_offset_frequency(scale_offset_freq_from_px(evt.pageX));
    }

}

function frequency_container_mousemove(evt) {
    var frequency = center_freq + scale_offset_freq_from_px(evt.pageX);
    $('.webrx-mouse-freq').frequencyDisplay().setFrequency(frequency);
}

function scale_canvas_end_drag(x) {
    scale_canvas.style.cursor = "default";
    scale_canvas_drag_params.drag = false;
    scale_canvas_drag_params.mouse_down = false;
    var event_handled = false;
    var demodulators = getDemodulators();
    for (var i = 0; i < demodulators.length; i++) event_handled |= demodulators[i].envelope.drag_end();
    if (!event_handled) demodulators[0].set_offset_frequency(scale_offset_freq_from_px(x));
}

function scale_canvas_mouseup(evt) {
    scale_canvas_end_drag(evt.pageX);
}

function scale_px_from_freq(f, range) {
    return Math.round(((f - range.start) / range.bw) * waterfallWidth());
}

function get_visible_freq_range() {
    var out = {};
    var fcalc = function (x) {
        var canvasWidth = waterfallWidth() * zoom_levels[zoom_level];
        return Math.round(((-zoom_offset_px + x) / canvasWidth) * bandwidth) + (center_freq - bandwidth / 2);
    };
    out.start = fcalc(0);
    out.center = fcalc(waterfallWidth() / 2);
    out.end = fcalc(waterfallWidth());
    out.bw = out.end - out.start;
    out.hps = out.bw / waterfallWidth();
    return out;
}

var scale_markers_levels = [
    {
        "large_marker_per_hz": 10000000, //large
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 0
    },
    {
        "large_marker_per_hz": 5000000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 0
    },
    {
        "large_marker_per_hz": 1000000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 0
    },
    {
        "large_marker_per_hz": 500000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 1
    },
    {
        "large_marker_per_hz": 100000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 1
    },
    {
        "large_marker_per_hz": 50000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 2
    },
    {
        "large_marker_per_hz": 10000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 2
    },
    {
        "large_marker_per_hz": 5000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 3
    },
    {
        "large_marker_per_hz": 1000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 1
    }
];
var scale_min_space_bw_texts = 50;
var scale_min_space_bw_small_markers = 7;

function get_scale_mark_spacing(range) {
    var out = {};
    var fcalc = function (freq) {
        out.numlarge = (range.bw / freq);
        out.large = waterfallWidth() / out.numlarge; 	//distance between large markers (these have text)
        out.ratio = 5; 														//(ratio-1) small markers exist per large marker
        out.small = out.large / out.ratio; 								//distance between small markers
        if (out.small < scale_min_space_bw_small_markers) return false;
        if (out.small / 2 >= scale_min_space_bw_small_markers && freq.toString()[0] !== "5") {
            out.small /= 2;
            out.ratio *= 2;
        }
        out.smallbw = freq / out.ratio;
        return true;
    };
    for (var i = scale_markers_levels.length - 1; i >= 0; i--) {
        var mp = scale_markers_levels[i];
        if (!fcalc(mp.large_marker_per_hz)) continue;
        //console.log(mp.large_marker_per_hz);
        //console.log(out);
        if (out.large - mp.estimated_text_width > scale_min_space_bw_texts) break;
    }
    out.params = mp;
    return out;
}

var range;

function mkscale() {
    //clear the lower part of the canvas (where frequency scale resides; the upper part is used by filter envelopes):
    range = get_visible_freq_range();
    mkenvelopes(range); //when scale changes we will always have to redraw filter envelopes, too
    scale_ctx.clearRect(0, 22, scale_ctx.canvas.width, scale_ctx.canvas.height - 22);
    scale_ctx.strokeStyle = "#fff";
    scale_ctx.font = "bold 11px sans-serif";
    scale_ctx.textBaseline = "top";
    scale_ctx.fillStyle = "#fff";
    var spacing = get_scale_mark_spacing(range);
    //console.log(spacing);
    var marker_hz = Math.ceil(range.start / spacing.smallbw) * spacing.smallbw;
    var text_h_pos = 22 + 10 + ((is_firefox) ? 3 : 0);
    var text_to_draw = '';
    var ftext = function (f) {
        text_to_draw = format_frequency(spacing.params.format, f, spacing.params.pre_divide, spacing.params.decimals);
    };
    var last_large;
    var x;
    for (; ;) {
        x = scale_px_from_freq(marker_hz, range);
        if (x > window.innerWidth) break;
        scale_ctx.beginPath();
        scale_ctx.moveTo(x, 22);
        if (marker_hz % spacing.params.large_marker_per_hz === 0) {  //large marker
            if (typeof first_large === "undefined") var first_large = marker_hz;
            last_large = marker_hz;
            scale_ctx.lineWidth = 3.5;
            scale_ctx.lineTo(x, 22 + 11);
            ftext(marker_hz);
            var text_measured = scale_ctx.measureText(text_to_draw);
            scale_ctx.textAlign = "center";
            //advanced text drawing begins
            if (zoom_level === 0 && (range.start + spacing.smallbw * spacing.ratio > marker_hz) && (x < text_measured.width / 2)) { //if this is the first overall marker when zoomed out...                  and if it would be clipped off the screen...
                if (scale_px_from_freq(marker_hz + spacing.smallbw * spacing.ratio, range) - text_measured.width >= scale_min_space_bw_texts) { //and if we have enough space to draw it correctly without clipping
                    scale_ctx.textAlign = "left";
                    scale_ctx.fillText(text_to_draw, 0, text_h_pos);
                }
            }
            else if (zoom_level === 0 && (range.end - spacing.smallbw * spacing.ratio < marker_hz) && (x > window.innerWidth - text_measured.width / 2)) { //     if this is the last overall marker when zoomed out...                 and if it would be clipped off the screen...
                if (window.innerWidth - text_measured.width - scale_px_from_freq(marker_hz - spacing.smallbw * spacing.ratio, range) >= scale_min_space_bw_texts) { //and if we have enough space to draw it correctly without clipping
                    scale_ctx.textAlign = "right";
                    scale_ctx.fillText(text_to_draw, window.innerWidth, text_h_pos);
                }
            }
            else scale_ctx.fillText(text_to_draw, x, text_h_pos); //draw text normally
        }
        else {  //small marker
            scale_ctx.lineWidth = 2;
            scale_ctx.lineTo(x, 22 + 8);
        }
        marker_hz += spacing.smallbw;
        scale_ctx.stroke();
    }
    if (zoom_level !== 0) { // if zoomed, we don't want the texts to disappear because their markers can't be seen
        // on the left side
        scale_ctx.textAlign = "center";
        var f = first_large - spacing.smallbw * spacing.ratio;
        x = scale_px_from_freq(f, range);
        ftext(f);
        var w = scale_ctx.measureText(text_to_draw).width;
        if (x + w / 2 > 0) scale_ctx.fillText(text_to_draw, x, 22 + 10);
        // on the right side
        f = last_large + spacing.smallbw * spacing.ratio;
        x = scale_px_from_freq(f, range);
        ftext(f);
        w = scale_ctx.measureText(text_to_draw).width;
        if (x - w / 2 < window.innerWidth) scale_ctx.fillText(text_to_draw, x, 22 + 10);
    }
}

function resize_scale() {
    var ratio = window.devicePixelRatio || 1;
    var w = window.innerWidth;
    var h = 47;
    scale_canvas.style.width = w + "px";
    scale_canvas.style.height = h + "px";
    w *= ratio;
    h *= ratio;
    scale_canvas.width = w;
    scale_canvas.height = h;
    scale_ctx.scale(ratio, ratio);
    mkscale();
    bookmarks.position();
}

function canvas_get_freq_offset(relativeX) {
    var rel = (relativeX / canvases[0].clientWidth);
    return Math.round((bandwidth * rel) - (bandwidth / 2));
}

function canvas_get_frequency(relativeX) {
    return center_freq + canvas_get_freq_offset(relativeX);
}


function format_frequency(format, freq_hz, pre_divide, decimals) {
    var out = format.replace("{x}", (freq_hz / pre_divide).toFixed(decimals));
    var at = out.indexOf(".") + 4;
    while (decimals > 3) {
        out = out.substr(0, at) + "," + out.substr(at);
        at += 4;
        decimals -= 3;
    }
    return out;
}

var canvas_drag = false;
var canvas_drag_min_delta = 1;
var canvas_mouse_down = false;
var canvas_drag_last_x;
var canvas_drag_last_y;
var canvas_drag_start_x;
var canvas_drag_start_y;

function canvas_mousedown(evt) {
    canvas_mouse_down = true;
    canvas_drag = false;
    canvas_drag_last_x = canvas_drag_start_x = evt.pageX;
    canvas_drag_last_y = canvas_drag_start_y = evt.pageY;
    evt.preventDefault(); //don't show text selection mouse pointer
}

function canvas_mousemove(evt) {
    if (!waterfall_setup_done) return;
    var relativeX = get_relative_x(evt);
    if (canvas_mouse_down) {
        if (!canvas_drag && Math.abs(evt.pageX - canvas_drag_start_x) > canvas_drag_min_delta) {
            canvas_drag = true;
            canvas_container.style.cursor = "move";
        }
        if (canvas_drag) {
            var deltaX = canvas_drag_last_x - evt.pageX;
            var dpx = range.hps * deltaX;
            if (
                !(zoom_center_rel + dpx > (bandwidth / 2 - waterfallWidth() * (1 - zoom_center_where) * range.hps)) &&
                !(zoom_center_rel + dpx < -bandwidth / 2 + waterfallWidth() * zoom_center_where * range.hps)
            ) {
                zoom_center_rel += dpx;
            }
            resize_canvases(false);
            canvas_drag_last_x = evt.pageX;
            canvas_drag_last_y = evt.pageY;
            mkscale();
            bookmarks.position();
        }
    } else {
        $('.webrx-mouse-freq').frequencyDisplay().setFrequency(canvas_get_frequency(relativeX));
    }
}

function canvas_container_mouseleave() {
    canvas_end_drag();
}

function canvas_mouseup(evt) {
    if (!waterfall_setup_done) return;
    var relativeX = get_relative_x(evt);

    if (!canvas_drag) {
        $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().set_offset_frequency(canvas_get_freq_offset(relativeX));
    }
    else {
        canvas_end_drag();
    }
    canvas_mouse_down = false;
}

function canvas_end_drag() {
    canvas_container.style.cursor = "crosshair";
    canvas_mouse_down = false;
}

function zoom_center_where_calc(screenposX) {
    return screenposX / waterfallWidth();
}

function get_relative_x(evt) {
    var relativeX = evt.offsetX || evt.layerX;
    if ($(evt.target).closest(canvas_container).length) return relativeX;
    // compensate for the frequency scale, since that is not resized by the browser.
    var relatives = $(evt.target).closest('#openwebrx-frequency-container').map(function(){
        return evt.pageX - this.offsetLeft;
    });
    if (relatives.length) relativeX = relatives[0];

    return relativeX - zoom_offset_px;
}

function canvas_mousewheel(evt) {
    if (!waterfall_setup_done) return;
    var relativeX = get_relative_x(evt);
    var dir = (evt.deltaY / Math.abs(evt.deltaY)) > 0;
    zoom_step(dir, relativeX, zoom_center_where_calc(evt.pageX));
    evt.preventDefault();
}


var zoom_max_level_hps = 33; //Hz/pixel
var zoom_levels_count = 14;

function get_zoom_coeff_from_hps(hps) {
    var shown_bw = (window.innerWidth * hps);
    return bandwidth / shown_bw;
}

var zoom_levels = [1];
var zoom_level = 0;
var zoom_offset_px = 0;
var zoom_center_rel = 0;
var zoom_center_where = 0;

var smeter_level = 0;

function mkzoomlevels() {
    zoom_levels = [1];
    var maxc = get_zoom_coeff_from_hps(zoom_max_level_hps);
    if (maxc < 1) return;
    // logarithmic interpolation
    var zoom_ratio = Math.pow(maxc, 1 / zoom_levels_count);
    for (var i = 1; i < zoom_levels_count; i++)
        zoom_levels.push(Math.pow(zoom_ratio, i));
}

function zoom_step(out, where, onscreen) {
    if ((out && zoom_level === 0) || (!out && zoom_level >= zoom_levels_count - 1)) return;
    if (out) --zoom_level;
    else ++zoom_level;

    zoom_center_rel = canvas_get_freq_offset(where);
    //console.log("zoom_step || zlevel: "+zoom_level.toString()+" zlevel_val: "+zoom_levels[zoom_level].toString()+" zoom_center_rel: "+zoom_center_rel.toString());
    zoom_center_where = onscreen;
    //console.log(zoom_center_where, zoom_center_rel, where);
    resize_canvases(true);
    mkscale();
    bookmarks.position();
}

function zoom_set(level) {
    if (!(level >= 0 && level <= zoom_levels.length - 1)) return;
    level = parseInt(level);
    zoom_level = level;
    //zoom_center_rel=canvas_get_freq_offset(-canvases[0].offsetLeft+waterfallWidth()/2); //zoom to screen center instead of demod envelope
    zoom_center_rel = $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().get_offset_frequency();
    zoom_center_where = 0.5 + (zoom_center_rel / bandwidth); //this is a kind of hack
    resize_canvases(true);
    mkscale();
    bookmarks.position();
}

function zoom_calc() {
    var winsize = waterfallWidth();
    var canvases_new_width = winsize * zoom_levels[zoom_level];
    zoom_offset_px = -((canvases_new_width * (0.5 + zoom_center_rel / bandwidth)) - (winsize * zoom_center_where));
    if (zoom_offset_px > 0) zoom_offset_px = 0;
    if (zoom_offset_px < winsize - canvases_new_width)
        zoom_offset_px = winsize - canvases_new_width;
}

var networkSpeedMeasurement;
var currentprofile;

var COMPRESS_FFT_PAD_N = 10; //should be the same as in csdr.c

function on_ws_recv(evt) {
    if (typeof evt.data === 'string') {
        // text messages
        networkSpeedMeasurement.add(evt.data.length);

        if (evt.data.substr(0, 16) === "CLIENT DE SERVER") {
            divlog("Server acknowledged WebSocket connection.");
        } else {
            try {
                var json = JSON.parse(evt.data);
                switch (json.type) {
                    case "config":
                        var config = json['value'];
                        waterfall_colors = config['waterfall_colors'];
                        waterfall_min_level_default = config['waterfall_min_level'];
                        waterfall_max_level_default = config['waterfall_max_level'];
                        waterfall_auto_level_margin = config['waterfall_auto_level_margin'];
                        waterfallColorsDefault();

                        var initial_demodulator_params = {
                            mod: config['start_mod'],
                            offset_frequency: config['start_offset_freq']
                        };

                        bandwidth = config['samp_rate'];
                        center_freq = config['center_freq'];
                        fft_size = config['fft_size'];
                        var audio_compression = config['audio_compression'];
                        audioEngine.setCompression(audio_compression);
                        divlog("Audio stream is " + ((audio_compression === "adpcm") ? "compressed" : "uncompressed") + ".");
                        fft_compression = config['fft_compression'];
                        divlog("FFT stream is " + ((fft_compression === "adpcm") ? "compressed" : "uncompressed") + ".");
                        clientProgressBar.setMaxClients(config['max_clients']);
                        var sql = Number.isInteger(config['initial_squelch_level']) ? config['initial_squelch_level'] : -150;
                        $("#openwebrx-panel-squelch").val(sql);
                        updateSquelch();

                        waterfall_init();
                        var demodulatorPanel = $('#openwebrx-panel-receiver').demodulatorPanel();
                        demodulatorPanel.setInitialParams(initial_demodulator_params);
                        demodulatorPanel.setCenterFrequency(center_freq);
                        bookmarks.loadLocalBookmarks();

                        waterfall_clear();

                        currentprofile = config['sdr_id'] + '|' + config['profile_id'];
                        $('#openwebrx-sdr-profiles-listbox').val(currentprofile);

                        break;
                    case "secondary_config":
                        var s = json['value'];
                        window.secondary_fft_size = s['secondary_fft_size'];
                        window.secondary_bw = s['secondary_bw'];
                        window.if_samp_rate = s['if_samp_rate'];
                        secondary_demod_init_canvases();
                        break;
                    case "receiver_details":
                        var r = json['value'];
                        e('webrx-rx-title').innerHTML = r['receiver_name'];
                        var query = encodeURIComponent(r['receiver_gps']['lat'] + ',' + r['receiver_gps']['lon']);
                        e('webrx-rx-desc').innerHTML = r['receiver_location'] + ' | Loc: ' + r['locator'] + ', ASL: ' + r['receiver_asl'] + ' m, <a href="https://www.google.com/maps/search/?api=1&query=' + query + '" target="_blank" onclick="dont_toggle_rx_photo();">[maps]</a>';
                        e('webrx-rx-photo-title').innerHTML = r['photo_title'];
                        e('webrx-rx-photo-desc').innerHTML = r['photo_desc'];
                        break;
                    case "smeter":
                        smeter_level = json['value'];
                        setSmeterAbsoluteValue(smeter_level);
                        break;
                    case "cpuusage":
                        cpuProgressBar.setUsage(json['value']);
                        break;
                    case "clients":
                        clientProgressBar.setClients(json['value']);
                        break;
                    case "profiles":
                        var listbox = e("openwebrx-sdr-profiles-listbox");
                        listbox.innerHTML = json['value'].map(function (profile) {
                            return '<option value="' + profile['id'] + '">' + profile['name'] + "</option>";
                        }).join("");
                        if (currentprofile) {
                            $('#openwebrx-sdr-profiles-listbox').val(currentprofile);
                        }
                        break;
                    case "features":
                        Modes.setFeatures(json['value']);
                        break;
                    case "metadata":
                        update_metadata(json['value']);
                        break;
                    case "js8_message":
                        $("#openwebrx-panel-js8-message").js8().pushMessage(json['value']);
                        break;
                    case "wsjt_message":
                        update_wsjt_panel(json['value']);
                        break;
                    case "dial_frequencies":
                        var as_bookmarks = json['value'].map(function (d) {
                            return {
                                name: d['mode'].toUpperCase(),
                                modulation: d['mode'],
                                frequency: d['frequency']
                            };
                        });
                        bookmarks.replace_bookmarks(as_bookmarks, 'dial_frequencies');
                        break;
                    case "aprs_data":
                        update_packet_panel(json['value']);
                        break;
                    case "bookmarks":
                        bookmarks.replace_bookmarks(json['value'], "server");
                        break;
                    case "sdr_error":
                        divlog(json['value'], true);
                        var $overlay = $('#openwebrx-error-overlay');
                        $overlay.find('.errormessage').text(json['value']);
                        $overlay.show();
                        break;
                    case 'secondary_demod':
                        secondary_demod_push_data(json['value']);
                        break;
                    case 'log_message':
                        divlog(json['value'], true);
                        break;
                    case 'pocsag_data':
                        update_pocsag_panel(json['value']);
                        break;
                    case 'backoff':
                        divlog("Server is currently busy: " + json['reason'], true);
                        var $overlay = $('#openwebrx-error-overlay');
                        $overlay.find('.errormessage').text(json['reason']);
                        $overlay.show();
                        // set a higher reconnection timeout right away to avoid additional load
                        reconnect_timeout = 16000;
                        break;
                    case 'modes':
                        Modes.setModes(json['value']);
                        break;
                    default:
                        console.warn('received message of unknown type: ' + json['type']);
                }
            } catch (e) {
                // don't lose exception
                console.error(e)
            }
        }
    } else if (evt.data instanceof ArrayBuffer) {
        // binary messages
        networkSpeedMeasurement.add(evt.data.byteLength);

        var type = new Uint8Array(evt.data, 0, 1)[0];
        var data = evt.data.slice(1);

        var waterfall_i16;
        var waterfall_f32;
        var i;

        switch (type) {
            case 1:
                // FFT data
                if (fft_compression === "none") {
                    waterfall_add(new Float32Array(data));
                } else if (fft_compression === "adpcm") {
                    fft_codec.reset();

                    waterfall_i16 = fft_codec.decode(new Uint8Array(data));
                    waterfall_f32 = new Float32Array(waterfall_i16.length - COMPRESS_FFT_PAD_N);
                    for (i = 0; i < waterfall_i16.length; i++) waterfall_f32[i] = waterfall_i16[i + COMPRESS_FFT_PAD_N] / 100;
                    waterfall_add(waterfall_f32);
                }
                break;
            case 2:
                // audio data
                audioEngine.pushAudio(data);
                break;
            case 3:
                // secondary FFT
                if (fft_compression === "none") {
                    secondary_demod_waterfall_add(new Float32Array(data));
                } else if (fft_compression === "adpcm") {
                    fft_codec.reset();

                    waterfall_i16 = fft_codec.decode(new Uint8Array(data));
                    waterfall_f32 = new Float32Array(waterfall_i16.length - COMPRESS_FFT_PAD_N);
                    for (i = 0; i < waterfall_i16.length; i++) waterfall_f32[i] = waterfall_i16[i + COMPRESS_FFT_PAD_N] / 100;
                    secondary_demod_waterfall_add(waterfall_f32);
                }
                break;
            default:
                console.warn('unknown type of binary message: ' + type)
        }
    }
}

function update_metadata(meta) {
    var el;
    if (meta['protocol']) switch (meta['protocol']) {
        case 'DMR':
            if (meta['slot']) {
                el = $("#openwebrx-panel-metadata-dmr").find(".openwebrx-dmr-timeslot-panel").get(meta['slot']);
                var id = "";
                var name = "";
                var target = "";
                var group = false;
                $(el)[meta['sync'] ? "addClass" : "removeClass"]("sync");
                if (meta['sync'] && meta['sync'] === "voice") {
                    id = (meta['additional'] && meta['additional']['callsign']) || meta['source'] || "";
                    name = (meta['additional'] && meta['additional']['fname']) || "";
                    if (meta['type'] === "group") {
                        target = "Talkgroup: ";
                        group = true;
                    }
                    if (meta['type'] === "direct") target = "Direct: ";
                    target += meta['target'] || "";
                    $(el).addClass("active");
                } else {
                    $(el).removeClass("active");
                }
                $(el).find(".openwebrx-dmr-id").text(id);
                $(el).find(".openwebrx-dmr-name").text(name);
                $(el).find(".openwebrx-dmr-target").text(target);
                $(el).find(".openwebrx-meta-user-image")[group ? "addClass" : "removeClass"]("group");
            } else {
                clear_metadata();
            }
            break;
        case 'YSF':
            el = $("#openwebrx-panel-metadata-ysf");

            var mode = " ";
            var source = "";
            var up = "";
            var down = "";
            if (meta['mode'] && meta['mode'] !== "") {
                mode = "Mode: " + meta['mode'];
                source = meta['source'] || "";
                if (meta['lat'] && meta['lon'] && meta['source']) {
                    source = "<a class=\"openwebrx-maps-pin\" href=\"map?callsign=" + meta['source'] + "\" target=\"_blank\"></a>" + source;
                }
                up = meta['up'] ? "Up: " + meta['up'] : "";
                down = meta['down'] ? "Down: " + meta['down'] : "";
                $(el).find(".openwebrx-meta-slot").addClass("active");
            } else {
                $(el).find(".openwebrx-meta-slot").removeClass("active");
            }
            $(el).find(".openwebrx-ysf-mode").text(mode);
            $(el).find(".openwebrx-ysf-source").html(source);
            $(el).find(".openwebrx-ysf-up").text(up);
            $(el).find(".openwebrx-ysf-down").text(down);

            break;
    } else {
        clear_metadata();
    }

}

function html_escape(input) {
    return $('<div/>').text(input).html()
}

function update_wsjt_panel(msg) {
    var $b = $('#openwebrx-panel-wsjt-message').find('tbody');
    var t = new Date(msg['timestamp']);
    var pad = function (i) {
        return ('' + i).padStart(2, "0");
    };
    var linkedmsg = msg['msg'];
    var matches;
    if (['FT8', 'JT65', 'JT9', 'FT4'].indexOf(msg['mode']) >= 0) {
        matches = linkedmsg.match(/(.*\s[A-Z0-9]+\s)([A-R]{2}[0-9]{2})$/);
        if (matches && matches[2] !== 'RR73') {
            linkedmsg = html_escape(matches[1]) + '<a href="map?locator=' + matches[2] + '" target="_blank">' + matches[2] + '</a>';
        } else {
            linkedmsg = html_escape(linkedmsg);
        }
    } else if (msg['mode'] === 'WSPR') {
        matches = linkedmsg.match(/([A-Z0-9]*\s)([A-R]{2}[0-9]{2})(\s[0-9]+)/);
        if (matches) {
            linkedmsg = html_escape(matches[1]) + '<a href="map?locator=' + matches[2] + '" target="_blank">' + matches[2] + '</a>' + html_escape(matches[3]);
        } else {
            linkedmsg = html_escape(linkedmsg);
        }
    }
    $b.append($(
        '<tr data-timestamp="' + msg['timestamp'] + '">' +
        '<td>' + pad(t.getUTCHours()) + pad(t.getUTCMinutes()) + pad(t.getUTCSeconds()) + '</td>' +
        '<td class="decimal">' + msg['db'] + '</td>' +
        '<td class="decimal">' + msg['dt'] + '</td>' +
        '<td class="decimal freq">' + msg['freq'] + '</td>' +
        '<td class="message">' + linkedmsg + '</td>' +
        '</tr>'
    ));
    $b.scrollTop($b[0].scrollHeight);
}

var digital_removal_interval;

// remove old wsjt messages in fixed intervals
function init_digital_removal_timer() {
    if (digital_removal_interval) clearInterval(digital_removal_interval);
    digital_removal_interval = setInterval(function () {
        ['#openwebrx-panel-wsjt-message', '#openwebrx-panel-packet-message'].forEach(function (root) {
            var $elements = $(root + ' tbody tr');
            // limit to 1000 entries in the list since browsers get laggy at some point
            var toRemove = $elements.length - 1000;
            if (toRemove <= 0) return;
            $elements.slice(0, toRemove).remove();
        });
    }, 15000);
}

function update_packet_panel(msg) {
    var $b = $('#openwebrx-panel-packet-message').find('tbody');
    var pad = function (i) {
        return ('' + i).padStart(2, "0");
    };

    if (msg.type && msg.type === 'thirdparty' && msg.data) {
        msg = msg.data;
    }
    var source = msg.source;
    if (msg.type) {
        if (msg.type === 'item') {
            source = msg.item;
        }
        if (msg.type === 'object') {
            source = msg.object;
        }
    }

    var timestamp = '';
    if (msg.timestamp) {
        var t = new Date(msg.timestamp);
        timestamp = pad(t.getUTCHours()) + pad(t.getUTCMinutes()) + pad(t.getUTCSeconds())
    }

    var link = '';
    var classes = [];
    var styles = {};
    var overlay = '';
    var stylesToString = function (s) {
        return $.map(s, function (value, key) {
            return key + ':' + value + ';'
        }).join('')
    };
    if (msg.symbol) {
        classes.push('aprs-symbol');
        classes.push('aprs-symboltable-' + (msg.symbol.table === '/' ? 'normal' : 'alternate'));
        styles['background-position-x'] = -(msg.symbol.index % 16) * 15 + 'px';
        styles['background-position-y'] = -Math.floor(msg.symbol.index / 16) * 15 + 'px';
        if (msg.symbol.table !== '/' && msg.symbol.table !== '\\') {
            var s = {};
            s['background-position-x'] = -(msg.symbol.tableindex % 16) * 15 + 'px';
            s['background-position-y'] = -Math.floor(msg.symbol.tableindex / 16) * 15 + 'px';
            overlay = '<div class="aprs-symbol aprs-symboltable-overlay" style="' + stylesToString(s) + '"></div>';
        }
    } else if (msg.lat && msg.lon) {
        classes.push('openwebrx-maps-pin');
    }
    var attrs = [
        'class="' + classes.join(' ') + '"',
        'style="' + stylesToString(styles) + '"'
    ].join(' ');
    if (msg.lat && msg.lon) {
        link = '<a ' + attrs + ' href="map?callsign=' + source + '" target="_blank">' + overlay + '</a>';
    } else {
        link = '<div ' + attrs + '>' + overlay + '</div>'
    }

    $b.append($(
        '<tr>' +
        '<td>' + timestamp + '</td>' +
        '<td class="callsign">' + source + '</td>' +
        '<td class="coord">' + link + '</td>' +
        '<td class="message">' + (msg.comment || msg.message || '') + '</td>' +
        '</tr>'
    ));
    $b.scrollTop($b[0].scrollHeight);
}

function update_pocsag_panel(msg) {
    var $b = $('#openwebrx-panel-pocsag-message').find('tbody');
    $b.append($(
        '<tr>' +
        '<td class="address">' + msg.address + '</td>' +
        '<td class="message">' + msg.message + '</td>' +
        '</tr>'
    ));
    $b.scrollTop($b[0].scrollHeight);
}

function update_digitalvoice_panels(showing) {
    $(".openwebrx-meta-panel").each(function (_, p) {
        toggle_panel(p.id, p.id === showing);
    });
    clear_metadata();
}

function clear_metadata() {
    $(".openwebrx-meta-panel .openwebrx-meta-autoclear").text("");
    $(".openwebrx-meta-slot").removeClass("active").removeClass("sync");
    $(".openwebrx-dmr-timeslot-panel").removeClass("muted");
}

var waterfall_measure_minmax = false;
var waterfall_measure_minmax_now = false;
var waterfall_measure_minmax_min = 1e100;
var waterfall_measure_minmax_max = -1e100;

function waterfall_measure_minmax_do(what) {
    // this is based on an oversampling factor of about 1,25
    var ignored = .1 * what.length;
    var data = what.slice(ignored, -ignored);
    waterfall_measure_minmax_min = Math.min(waterfall_measure_minmax_min, Math.min.apply(Math, data));
    waterfall_measure_minmax_max = Math.max(waterfall_measure_minmax_max, Math.max.apply(Math, data));
}

function on_ws_opened() {
    $('#openwebrx-error-overlay').hide();
    ws.send("SERVER DE CLIENT client=openwebrx.js type=receiver");
    divlog("WebSocket opened to " + ws.url);
    if (!networkSpeedMeasurement) {
        networkSpeedMeasurement = new Measurement();
        networkSpeedMeasurement.report(60000, 1000, function(rate){
            networkSpeedProgressBar.setSpeed(rate);
        });
    } else {
        networkSpeedMeasurement.reset();
    }
    reconnect_timeout = false;
    ws.send(JSON.stringify({
        "type": "connectionproperties",
        "params": {"output_rate": audioEngine.getOutputRate()}
    }));
}

var was_error = 0;

function divlog(what, is_error) {
    is_error = !!is_error;
    was_error |= is_error;
    if (is_error) {
        what = "<span class=\"webrx-error\">" + what + "</span>";
        toggle_panel("openwebrx-panel-log", true); //show panel if any error is present
    }
    e("openwebrx-debugdiv").innerHTML += what + "<br />";
    var nano = $('.nano');
    nano.nanoScroller();
    nano.nanoScroller({scroll: 'bottom'});
}

var volumeBeforeMute = 100.0;
var mute = false;

// Optimalise these if audio lags or is choppy:
var audio_buffer_maximal_length_sec = 1; //actual number of samples are calculated from sample rate

function onAudioStart(success, apiType){
    divlog('Web Audio API succesfully initialized, using ' + apiType  + ' API, sample rate: ' + audioEngine.getSampleRate() + " Hz");

    // canvas_container is set after waterfall_init() has been called. we cannot initialize before.
    //if (canvas_container) synchronize_demodulator_init();

    //hide log panel in a second (if user has not hidden it yet)
    window.setTimeout(function () {
        toggle_panel("openwebrx-panel-log", !!was_error);
    }, 2000);

    //Synchronise volume with slider
    updateVolume();
}

var reconnect_timeout = false;

function on_ws_closed() {
    $("#openwebrx-panel-receiver").demodulatorPanel().stopDemodulator();
    if (reconnect_timeout) {
        // max value: roundabout 8 and a half minutes
        reconnect_timeout = Math.min(reconnect_timeout * 2, 512000);
    } else {
        // initial value: 1s
        reconnect_timeout = 1000;
    }
    divlog("WebSocket has closed unexpectedly. Attempting to reconnect in " + reconnect_timeout / 1000 + " seconds...", 1);

    setTimeout(open_websocket, reconnect_timeout);
}

function on_ws_error() {
    divlog("WebSocket error.", 1);
}

var ws;

function open_websocket() {
    var protocol = window.location.protocol.match(/https/) ? 'wss' : 'ws';

    var href = window.location.href;
    var index = href.lastIndexOf('/');
    if (index > 0) {
        href = href.substr(0, index + 1);
    }
    href = href.split("://")[1];
    href = protocol + "://" + href;
    if (!href.endsWith('/')) {
        href += '/';
    }
    var ws_url = href + "ws/";

    if (!("WebSocket" in window))
        divlog("Your browser does not support WebSocket, which is required for WebRX to run. Please upgrade to a HTML5 compatible browser.");
    ws = new WebSocket(ws_url);
    ws.onopen = on_ws_opened;
    ws.onmessage = on_ws_recv;
    ws.onclose = on_ws_closed;
    ws.binaryType = "arraybuffer";
    window.onbeforeunload = function () { //http://stackoverflow.com/questions/4812686/closing-websocket-correctly-html5-javascript
        ws.onclose = function () {
        };
        ws.close();
    };
    ws.onerror = on_ws_error;
}

function waterfall_mkcolor(db_value, waterfall_colors_arg) {
    if (typeof waterfall_colors_arg === 'undefined') waterfall_colors_arg = waterfall_colors;
    if (db_value < waterfall_min_level) db_value = waterfall_min_level;
    if (db_value > waterfall_max_level) db_value = waterfall_max_level;
    var full_scale = waterfall_max_level - waterfall_min_level;
    var relative_value = db_value - waterfall_min_level;
    var value_percent = relative_value / full_scale;
    var percent_for_one_color = 1 / (waterfall_colors_arg.length - 1);
    var index = Math.floor(value_percent / percent_for_one_color);
    var remain = (value_percent - percent_for_one_color * index) / percent_for_one_color;
    return color_between(waterfall_colors_arg[index + 1], waterfall_colors_arg[index], remain);
}

function color_between(first, second, percent) {
    var output = 0;
    for (var i = 0; i < 4; i++) {
        var add = ((((first & (0xff << (i * 8))) >>> 0) * percent) + (((second & (0xff << (i * 8))) >>> 0) * (1 - percent))) & (0xff << (i * 8));
        output |= add >>> 0;
    }
    return output >>> 0;
}


var canvas_context;
var canvases = [];
var canvas_default_height = 200;
var canvas_container;
var canvas_actual_line;

function add_canvas() {
    var new_canvas = document.createElement("canvas");
    new_canvas.width = fft_size;
    new_canvas.height = canvas_default_height;
    canvas_actual_line = canvas_default_height - 1;
    new_canvas.openwebrx_top = (-canvas_default_height + 1);
    new_canvas.style.top = new_canvas.openwebrx_top.toString() + "px";
    canvas_context = new_canvas.getContext("2d");
    canvas_container.appendChild(new_canvas);
    canvases.push(new_canvas);
    while (canvas_container && canvas_container.clientHeight + canvas_default_height * 2 < canvases.length * canvas_default_height) {
        var c = canvases.shift();
        if (!c) break;
        canvas_container.removeChild(c);
    }
}


function init_canvas_container() {
    canvas_container = e("webrx-canvas-container");
    canvas_container.addEventListener("mouseleave", canvas_container_mouseleave, false);
    canvas_container.addEventListener("mousemove", canvas_mousemove, false);
    canvas_container.addEventListener("mouseup", canvas_mouseup, false);
    canvas_container.addEventListener("mousedown", canvas_mousedown, false);
    canvas_container.addEventListener("wheel", canvas_mousewheel, false);
    var frequency_container = e("openwebrx-frequency-container");
    frequency_container.addEventListener("wheel", canvas_mousewheel, false);
    add_canvas();
}

canvas_maxshift = 0;

function shift_canvases() {
    canvases.forEach(function (p) {
        p.style.top = (p.openwebrx_top++).toString() + "px";
    });
    canvas_maxshift++;
}

function resize_canvases(zoom) {
    if (typeof zoom === "undefined") zoom = false;
    if (!zoom) mkzoomlevels();
    zoom_calc();
    $('#webrx-canvas-container').css({
        width: waterfallWidth() * zoom_levels[zoom_level] + 'px',
        left: zoom_offset_px + "px"
    });
}

function waterfall_init() {
    init_canvas_container();
    resize_canvases();
    scale_setup();
    mkzoomlevels();
    waterfall_setup_done = 1;
}

function waterfall_add(data) {
    if (!waterfall_setup_done) return;
    var w = fft_size;

    if (waterfall_measure_minmax) waterfall_measure_minmax_do(data);
    if (waterfall_measure_minmax_now) {
        waterfall_measure_minmax_do(data);
        waterfall_measure_minmax_now = false;
        waterfallColorsAuto();
    }

    //Add line to waterfall image
    var oneline_image = canvas_context.createImageData(w, 1);
    for (var x = 0; x < w; x++) {
        var color = waterfall_mkcolor(data[x]);
        for (i = 0; i < 4; i++)
            oneline_image.data[x * 4 + i] = ((color >>> 0) >> ((3 - i) * 8)) & 0xff;
    }

    //Draw image
    canvas_context.putImageData(oneline_image, 0, canvas_actual_line--);
    shift_canvases();
    if (canvas_actual_line < 0) add_canvas();
}

function waterfall_clear() {
    while (canvases.length) //delete all canvases
    {
        var x = canvases.shift();
        x.parentNode.removeChild(x);
    }
    add_canvas();
}

function openwebrx_resize() {
    resize_canvases();
    resize_scale();
}

function init_header() {
    $('#openwebrx-main-buttons').find('[data-toggle-panel]').click(function () {
        toggle_panel($(this).data('toggle-panel'));
    });
}

var audioBufferProgressBar;
var networkSpeedProgressBar;
var audioSpeedProgressBar;
var audioOutputProgressBar;
var clientProgressBar;
var cpuProgressBar;

function initProgressBars() {
    audioBufferProgressBar = new AudioBufferProgressBar($('#openwebrx-bar-audio-buffer'), audioEngine.getSampleRate());
    networkSpeedProgressBar = new NetworkSpeedProgressBar($('#openwebrx-bar-network-speed'));
    audioSpeedProgressBar = new AudioSpeedProgressBar($('#openwebrx-bar-audio-speed'));
    audioOutputProgressBar = new AudioOutputProgressBar($('#openwebrx-bar-audio-output'), audioEngine.getSampleRate());
    clientProgressBar = new ClientsProgressBar($('#openwebrx-bar-clients'));
    cpuProgressBar = new CpuProgressBar($('#openwebrx-bar-server-cpu'));
}

function audioReporter(stats) {
    if (typeof(stats.buffersize) !== 'undefined') {
        audioBufferProgressBar.setBuffersize(stats.buffersize);
    }

    if (typeof(stats.audioByteRate) !== 'undefined') {
        audioSpeedProgressBar.setSpeed(stats.audioByteRate * 8);
    }

    if (typeof(stats.audioRate) !== 'undefined') {
        audioOutputProgressBar.setAudioRate(stats.audioRate);
    }
}

var bookmarks;
var audioEngine;

function openwebrx_init() {
    audioEngine = new AudioEngine(audio_buffer_maximal_length_sec, audioReporter);
    $overlay = $('#openwebrx-autoplay-overlay');
    $overlay.on('click', playButtonClick);
    if (!audioEngine.isAllowed()) {
        $overlay.show();
    } else {
        audioEngine.start(onAudioStart);
    }
    fft_codec = new ImaAdpcmCodec();
    initProgressBars();
    init_rx_photo();
    open_websocket();
    secondary_demod_init();
    digimodes_init();
    initPanels();
    $('.webrx-mouse-freq').frequencyDisplay();
    $('#openwebrx-panel-receiver').demodulatorPanel();
    window.addEventListener("resize", openwebrx_resize);
    init_header();
    bookmarks = new BookmarkBar();
    initSliders();
}

function initSliders() {
    $('#openwebrx-panel-receiver').on('wheel', 'input[type=range]', function(ev){
        var $slider = $(this);
        if (!$slider.attr('step')) return;
        var val = Number($slider.val());
        var step = Number($slider.attr('step'));
        if (ev.originalEvent.deltaY > 0) {
            step *= -1;
        }
        $slider.val(val + step);
        $slider.trigger('change');
    });
}

function digimodes_init() {
    // initialze DMR timeslot muting
    $('.openwebrx-dmr-timeslot-panel').click(function (e) {
        $(e.currentTarget).toggleClass("muted");
        update_dmr_timeslot_filtering();
    });
}

function update_dmr_timeslot_filtering() {
    var filter = $('.openwebrx-dmr-timeslot-panel').map(function (index, el) {
        return (!$(el).hasClass("muted")) << index;
    }).toArray().reduce(function (acc, v) {
        return acc | v;
    }, 0);
    $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().setDmrFilter(filter);
}

function playButtonClick() {
    //On iOS, we can only start audio from a click or touch event.
    audioEngine.start(onAudioStart);
    var $overlay = $('#openwebrx-autoplay-overlay');
    $overlay.css('opacity', 0);
    $overlay.on('transitionend', function() {
        $overlay.hide();
    });
}

var rt = function (s, n) {
    return s.replace(/[a-zA-Z]/g, function (c) {
        return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + n) ? c : c - 26);
    });
};

// ========================================================
// =======================  PANELS  =======================
// ========================================================

function panel_displayed(el){
    return !(el.style && el.style.display && el.style.display === 'none')
}

function toggle_panel(what, on) {
    var item = $('#' + what)[0];
    if (!item) return;
    var displayed = panel_displayed(item);
    if (typeof on !== "undefined" && displayed === on) {
        return;
    }
    if (item.openwebrxDisableClick) return;
    if (displayed) {
        item.movement = 'collapse';
        item.style.transform = "perspective(600px) rotateX(90deg)";
        item.style.transitionProperty = 'transform';
    } else {
        item.movement = 'expand';
        item.style.display = 'block';
        setTimeout(function(){
            item.style.transitionProperty = 'transform';
            item.style.transform = 'perspective(600px) rotateX(0deg)';
        }, 20);
    }
    item.style.transitionDuration = "600ms";
    item.style.transitionDelay = "0ms";

    item.openwebrxDisableClick = true;

}

function first_show_panel(panel) {
    panel.style.transitionDuration = 0;
    panel.style.transitionDelay = 0;
    var rotx = (Math.random() > 0.5) ? -90 : 90;
    var roty = 0;
    if (Math.random() > 0.5) {
        var rottemp = rotx;
        rotx = roty;
        roty = rottemp;
    }
    if (rotx !== 0 && Math.random() > 0.5) rotx = 270;
    panel.style.transform = "perspective(600px) rotateX(%1deg) rotateY(%2deg)"
        .replace("%1", rotx.toString()).replace("%2", roty.toString());
    window.setTimeout(function () {
        panel.style.transitionDuration = "600ms";
        panel.style.transitionDelay = (Math.floor(Math.random() * 500)).toString() + "ms";
        panel.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg)";
    }, 1);
}

function initPanels() {
    $('#openwebrx-panels-container').find('.openwebrx-panel').each(function(){
        var el = this;
        el.openwebrxPanelTransparent = (!!el.dataset.panelTransparent);
        el.addEventListener('transitionend', function(ev){
            if (ev.target !== el) return;
            el.openwebrxDisableClick = false;
            el.style.transitionDuration = null;
            el.style.transitionDelay = null;
            el.style.transitionProperty = null;
            if (el.movement && el.movement === 'collapse') {
                el.style.display = 'none';
            }
        });
        if (panel_displayed(el)) first_show_panel(el);
    });
}

/*
  _____  _       _                     _
 |  __ \(_)     (_)                   | |
 | |  | |_  __ _ _ _ __ ___   ___   __| | ___  ___
 | |  | | |/ _` | | '_ ` _ \ / _ \ / _` |/ _ \/ __|
 | |__| | | (_| | | | | | | | (_) | (_| |  __/\__ \
 |_____/|_|\__, |_|_| |_| |_|\___/ \__,_|\___||___/
            __/ |
           |___/
*/

var secondary_demod_fft_offset_db = 30; //need to calculate that later
var secondary_demod_canvases_initialized = false;
var secondary_demod_listbox_updating = false;
var secondary_demod_channel_freq = 1000;
var secondary_demod_waiting_for_set = false;
var secondary_demod_low_cut;
var secondary_demod_high_cut;
var secondary_demod_mousedown = false;
var secondary_demod_canvas_width;
var secondary_demod_canvas_left;
var secondary_demod_canvas_container;
var secondary_demod_current_canvas_actual_line;
var secondary_demod_current_canvas_context;
var secondary_demod_current_canvas_index;
var secondary_demod_canvases;

function secondary_demod_create_canvas() {
    var new_canvas = document.createElement("canvas");
    new_canvas.width = secondary_fft_size;
    new_canvas.height = $(secondary_demod_canvas_container).height();
    new_canvas.style.width = $(secondary_demod_canvas_container).width() + "px";
    new_canvas.style.height = $(secondary_demod_canvas_container).height() + "px";
    secondary_demod_current_canvas_actual_line = new_canvas.height - 1;
    $(secondary_demod_canvas_container).children().last().before(new_canvas);
    return new_canvas;
}

function secondary_demod_remove_canvases() {
    $(secondary_demod_canvas_container).children("canvas").remove();
}

function secondary_demod_init_canvases() {
    secondary_demod_remove_canvases();
    secondary_demod_canvases = [];
    secondary_demod_canvases.push(secondary_demod_create_canvas());
    secondary_demod_canvases.push(secondary_demod_create_canvas());
    secondary_demod_canvases[0].openwebrx_top = -$(secondary_demod_canvas_container).height();
    secondary_demod_canvases[1].openwebrx_top = 0;
    secondary_demod_canvases_update_top();
    secondary_demod_current_canvas_context = secondary_demod_canvases[0].getContext("2d");
    secondary_demod_current_canvas_actual_line = $(secondary_demod_canvas_container).height() - 1;
    secondary_demod_current_canvas_index = 0;
    secondary_demod_canvases_initialized = true;
    mkscale(); //so that the secondary waterfall zoom level will be initialized
}

function secondary_demod_canvases_update_top() {
    for (var i = 0; i < 2; i++) secondary_demod_canvases[i].style.top = secondary_demod_canvases[i].openwebrx_top + "px";
}

function secondary_demod_swap_canvases() {
    secondary_demod_canvases[0 + !secondary_demod_current_canvas_index].openwebrx_top -= $(secondary_demod_canvas_container).height() * 2;
    secondary_demod_current_canvas_index = 0 + !secondary_demod_current_canvas_index;
    secondary_demod_current_canvas_context = secondary_demod_canvases[secondary_demod_current_canvas_index].getContext("2d");
    secondary_demod_current_canvas_actual_line = $(secondary_demod_canvas_container).height() - 1;
}

function secondary_demod_init() {
    secondary_demod_canvas_container = $("#openwebrx-digimode-canvas-container")[0];
    $(secondary_demod_canvas_container)
        .mousemove(secondary_demod_canvas_container_mousemove)
        .mouseup(secondary_demod_canvas_container_mouseup)
        .mousedown(secondary_demod_canvas_container_mousedown)
        .mouseenter(secondary_demod_canvas_container_mousein)
        .mouseleave(secondary_demod_canvas_container_mouseleave);
    init_digital_removal_timer();
}

function secondary_demod_push_data(x) {
    x = Array.from(x).filter(function (y) {
        var c = y.charCodeAt(0);
        return (c === 10 || (c >= 32 && c <= 126));
    }).map(function (y) {
        if (y === "&")
            return "&amp;";
        if (y === "<") return "&lt;";
        if (y === ">") return "&gt;";
        if (y === " ") return "&nbsp;";
        return y;
    }).map(function (y) {
        if (y === "\n")
            return "<br />";
        return "<span class=\"part\">" + y + "</span>";
    }).join("");
    $("#openwebrx-cursor-blink").before(x);
}

function secondary_demod_waterfall_add(data) {
    var w = secondary_fft_size;

    //Add line to waterfall image
    var oneline_image = secondary_demod_current_canvas_context.createImageData(w, 1);
    for (var x = 0; x < w; x++) {
        var color = waterfall_mkcolor(data[x] + secondary_demod_fft_offset_db);
        for (var i = 0; i < 4; i++) oneline_image.data[x * 4 + i] = ((color >>> 0) >> ((3 - i) * 8)) & 0xff;
    }

    //Draw image
    secondary_demod_current_canvas_context.putImageData(oneline_image, 0, secondary_demod_current_canvas_actual_line--);
    secondary_demod_canvases.map(function (x) {
        x.openwebrx_top += 1;
    })
    ;
    secondary_demod_canvases_update_top();
    if (secondary_demod_current_canvas_actual_line < 0) secondary_demod_swap_canvases();
}

function secondary_demod_update_marker() {
    var width = Math.max((secondary_bw / (if_samp_rate / 2)) * secondary_demod_canvas_width, 5);
    var center_at = (secondary_demod_channel_freq / (if_samp_rate / 2)) * secondary_demod_canvas_width + secondary_demod_canvas_left;
    var left = center_at - width / 2;
    $("#openwebrx-digimode-select-channel").width(width).css("left", left + "px")
}

function secondary_demod_update_channel_freq_from_event(evt) {
    if (typeof evt !== "undefined") {
        var relativeX = (evt.offsetX) ? evt.offsetX : evt.layerX;
        secondary_demod_channel_freq = secondary_demod_low_cut +
            (relativeX / $(secondary_demod_canvas_container).width()) * (secondary_demod_high_cut - secondary_demod_low_cut);
    }
    if (!secondary_demod_waiting_for_set) {
        secondary_demod_waiting_for_set = true;
        window.setTimeout(function () {
                $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().set_secondary_offset_freq(Math.floor(secondary_demod_channel_freq));
                secondary_demod_waiting_for_set = false;
            },
            50
        )
        ;
    }
    secondary_demod_update_marker();
}

function secondary_demod_canvas_container_mousein() {
    $("#openwebrx-digimode-select-channel").css("opacity", "0.7"); //.css("border-width", "1px");
}

function secondary_demod_canvas_container_mouseleave() {
    $("#openwebrx-digimode-select-channel").css("opacity", "0");
}

function secondary_demod_canvas_container_mousemove(evt) {
    if (secondary_demod_mousedown) secondary_demod_update_channel_freq_from_event(evt);
}

function secondary_demod_canvas_container_mousedown(evt) {
    if (evt.which === 1) secondary_demod_mousedown = true;
}

function secondary_demod_canvas_container_mouseup(evt) {
    if (evt.which === 1) secondary_demod_mousedown = false;
    secondary_demod_update_channel_freq_from_event(evt);
}


function secondary_demod_waterfall_set_zoom(low_cut, high_cut) {
    if (!secondary_demod_canvases_initialized) return;
    if (low_cut < 0 && high_cut < 0) {
        var hctmp = high_cut;
        var lctmp = low_cut;
        low_cut = -hctmp;
        high_cut = -lctmp;
    }
    else if (low_cut < 0 && high_cut > 0) {
        high_cut = Math.max(Math.abs(high_cut), Math.abs(low_cut));
        low_cut = 0;
    }
    secondary_demod_low_cut = low_cut;
    secondary_demod_high_cut = high_cut;
    var shown_bw = high_cut - low_cut;
    secondary_demod_canvas_width = $(secondary_demod_canvas_container).width() * (if_samp_rate / 2) / shown_bw;
    secondary_demod_canvas_left = -secondary_demod_canvas_width * (low_cut / (if_samp_rate / 2));
    //console.log("setzoom", secondary_demod_canvas_width, secondary_demod_canvas_left, low_cut, high_cut);
    secondary_demod_canvases.map(function (x) {
        $(x).css("left", secondary_demod_canvas_left + "px").css("width", secondary_demod_canvas_width + "px");
    })
    ;
    secondary_demod_update_channel_freq_from_event();
}

function sdr_profile_changed() {
    var value = $('#openwebrx-sdr-profiles-listbox').val();
    ws.send(JSON.stringify({type: "selectprofile", params: {profile: value}}));
}
