/**
 * Icon ពេលបើក App Android (splash · `windowSplashScreenAnimatedIcon`) ជា **vector** ដេរីវេពី `resources/icon.svg`។
 *
 * ⛔ ហេតុអ្វីមិនប្រើ `@mipmap/ic_launcher` ៖ Android គូរ icon splash ទំហំ 288dp ➜ ស្រទាប់ PNG របស់ adaptive icon
 *    ត្រូវពង្រីក ២–៣ ដង ➜ ព្រិល · ហើយ ROM ខ្លះមិនបិទជ្រុង ➜ ការ៉េពេញ (រូបថត tablet 11.5" របស់ម្ចាស់គម្រោង)។
 * ⛔ ប្រអប់ក្រហមត្រូវនៅក្នុងរង្វង់សុវត្ថិភាព 192dp (Android 12+ អាចបិទខាងក្រៅរង្វង់នោះ) ➜ រូបរាងដូចគ្នាទាំងពេល
 *    ROM បិទជ្រុង និងមិនបិទ។
 * ⛔ Function តែមួយនេះ ៖ `android-icons.mjs` សរសេរឯកសារ · `android-check.mjs` ប្រៀបឯកសារនឹងលទ្ធផលរបស់វា (logo ប្តូរ ➜ ធ្លាក់)។
 */
export const SPLASH_ICON_DP = 288;
export const SPLASH_SAFE_DIAMETER_DP = 192;
export const SPLASH_PLATE_DP = 150;

function attr(tag, name) {
    const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
    return m ? m[1] : null;
}

function color(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) throw new Error('ពណ៌មិនស្គាល់ក្នុង icon.svg ៖ ' + hex);
    return '#FF' + m[1].toUpperCase();
}

function num(n) {
    const r = Math.round(n * 1e6) / 1e6;
    return String(r);
}

function pathPoints(d) {
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    return pts;
}

function gradientXml(grad, bbox, indent) {
    const [x0, y0, x1, y1] = bbox;
    const at = (f, a, b) => a + (b - a) * Number(f);
    const lines = [
        `${indent}<gradient`,
        `${indent}    android:type="linear"`,
        `${indent}    android:startX="${num(at(grad.x1, x0, x1))}"`,
        `${indent}    android:startY="${num(at(grad.y1, y0, y1))}"`,
        `${indent}    android:endX="${num(at(grad.x2, x0, x1))}"`,
        `${indent}    android:endY="${num(at(grad.y2, y0, y1))}">`
    ];
    for (const s of grad.stops) lines.push(`${indent}    <item android:offset="${num(Number(s.offset))}" android:color="${color(s.color)}" />`);
    lines.push(`${indent}</gradient>`);
    return lines.join('\n');
}

export function parseIconSvg(svg) {
    const box = Number((svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) \1"/) || [])[1]);
    if (!(box > 0)) throw new Error('icon.svg ត្រូវមាន viewBox ការ៉េ');
    const gradients = {};
    for (const g of svg.matchAll(/<linearGradient\b([^>]*)>([\s\S]*?)<\/linearGradient>/g)) {
        const head = g[1];
        gradients[attr(head, 'id')] = {
            x1: attr(head, 'x1') || '0', y1: attr(head, 'y1') || '0', x2: attr(head, 'x2') || '1', y2: attr(head, 'y2') || '0',
            stops: [...g[2].matchAll(/<stop\b([^>]*)\/>/g)].map((s) => ({ offset: attr(s[1], 'offset'), color: attr(s[1], 'stop-color') }))
        };
    }
    const rectTag = (svg.match(/<rect\b[^>]*\/>/) || [])[0] || '';
    const rx = Number(attr(rectTag, 'rx'));
    if (!(rx >= 0) || Number(attr(rectTag, 'width')) !== box || Number(attr(rectTag, 'height')) !== box) {
        throw new Error('icon.svg ត្រូវមាន <rect> ពេញ viewBox ជាប្រអប់');
    }
    const plateFill = (attr(rectTag, 'fill') || '').match(/^url\(#(\w+)\)$/);
    const cubeHead = (svg.match(/<g id="cube"([^>]*)>/) || [])[1] || '';
    const cubeBody = (svg.match(/<g id="cube"[^>]*>([\s\S]*?)<\/g>/) || [])[1] || '';
    const cube = [...cubeBody.matchAll(/<path\b([^>]*)\/>/g)].map((p) => ({
        d: attr(p[1], 'd'),
        fill: attr(p[1], 'fill'),
        stroke: attr(p[1], 'stroke'),
        strokeWidth: Number(attr(p[1], 'stroke-width') || attr(cubeHead, 'stroke-width') || 0),
        lineJoin: attr(p[1], 'stroke-linejoin') || attr(cubeHead, 'stroke-linejoin'),
        lineCap: attr(p[1], 'stroke-linecap') || attr(cubeHead, 'stroke-linecap')
    }));
    if (!cube.length || cube.some((p) => !p.d)) throw new Error('icon.svg ត្រូវមាន <g id="cube"> ជាមួយ <path d>');
    return { box, rx, plateGradient: plateFill ? gradients[plateFill[1]] : null, plateColor: plateFill ? null : attr(rectTag, 'fill'), gradients, cube };
}

export function splashPlateGeometry(icon) {
    const scale = SPLASH_PLATE_DP / icon.box;
    const radius = icon.rx * scale;
    const half = SPLASH_PLATE_DP / 2;
    const reach = (half - radius) * Math.SQRT2 + radius;
    return { scale, radius, offset: (SPLASH_ICON_DP - SPLASH_PLATE_DP) / 2, reach };
}

export function splashIconVector(svg) {
    const icon = parseIconSvg(svg);
    const geo = splashPlateGeometry(icon);
    const b = icon.box;
    const r = icon.rx;
    const plate = `M${num(r)},0 H${num(b - r)} A${num(r)},${num(r)} 0 0 1 ${num(b)},${num(r)} V${num(b - r)} ` +
        `A${num(r)},${num(r)} 0 0 1 ${num(b - r)},${num(b)} H${num(r)} A${num(r)},${num(r)} 0 0 1 0,${num(b - r)} ` +
        `V${num(r)} A${num(r)},${num(r)} 0 0 1 ${num(r)},0 Z`;
    const out = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        '    xmlns:aapt="http://schemas.android.com/aapt"',
        `    android:width="${SPLASH_ICON_DP}dp"`,
        `    android:height="${SPLASH_ICON_DP}dp"`,
        `    android:viewportWidth="${SPLASH_ICON_DP}"`,
        `    android:viewportHeight="${SPLASH_ICON_DP}">`,
        '    <group',
        `        android:translateX="${num(geo.offset)}"`,
        `        android:translateY="${num(geo.offset)}"`,
        `        android:scaleX="${num(geo.scale)}"`,
        `        android:scaleY="${num(geo.scale)}">`
    ];
    if (icon.plateGradient) {
        out.push(`        <path android:pathData="${plate}">`);
        out.push('            <aapt:attr name="android:fillColor">');
        out.push(gradientXml(icon.plateGradient, [0, 0, b, b], '                '));
        out.push('            </aapt:attr>');
        out.push('        </path>');
    } else {
        out.push(`        <path android:pathData="${plate}" android:fillColor="${color(icon.plateColor)}" />`);
    }
    for (const p of icon.cube) {
        const pts = pathPoints(p.d);
        const xs = pts.map((q) => q[0]);
        const ys = pts.map((q) => q[1]);
        const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        const gradOf = (v) => { const m = (v || '').match(/^url\(#(\w+)\)$/); return m ? icon.gradients[m[1]] : null; };
        const attrs = [`android:pathData="${p.d}"`];
        const kids = [];
        const paint = (kind, v) => {
            if (!v || v === 'none') return;
            const g = gradOf(v);
            if (g) {
                kids.push(`            <aapt:attr name="android:${kind}">`);
                kids.push(gradientXml(g, bbox, '                '));
                kids.push('            </aapt:attr>');
            } else {
                attrs.push(`android:${kind}="${color(v)}"`);
            }
        };
        paint('fillColor', p.fill);
        if (p.stroke && p.stroke !== 'none') {
            paint('strokeColor', p.stroke);
            if (p.strokeWidth) attrs.push(`android:strokeWidth="${num(p.strokeWidth)}"`);
            if (p.lineJoin) attrs.push(`android:strokeLineJoin="${p.lineJoin}"`);
            if (p.lineCap) attrs.push(`android:strokeLineCap="${p.lineCap}"`);
        }
        const open = '        <path\n' + attrs.map((a) => '            ' + a).join('\n');
        if (kids.length) out.push(open + '>', ...kids, '        </path>');
        else out.push(open + ' />');
    }
    out.push('    </group>', '</vector>', '');
    return out.join('\n');
}
