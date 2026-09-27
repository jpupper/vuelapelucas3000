#ifdef GL_ES
precision highp float;
precision highp int;
#endif

#if __VERSION__ >= 300
out vec4 fragColor;
#else
#define fragColor gl_FragColor
#endif

// Reservados (no aparecen en el panel)
uniform vec2 resolution;
uniform float time;

// Parametros configurables (detectados dinamicamente por el panel [P])
// Valores normalizados entre 0.0 y 1.0
uniform float speed;
uniform float scale;
uniform float colorCycle;
uniform float contrast;
uniform float brightness;

#define fx (resolution.x / resolution.y)
#define PI 3.14159265359

// Simplex Noise 2D
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,
                        0.366025403784439,
                       -0.577350269189626,
                        0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 x1 = x0.xy + C.xx - i1;
    vec2 x2 = x0.xy + C.zz;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * vec2(x1.x, x2.x) + h.yz * vec2(x1.y, x2.y);
    return 130.0 * dot(m, g);
}

// Fractal Brownian Motion (multicapa de noise sutil)
float fbm(vec2 st, float t) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
        v += a * snoise(st + vec2(t * 0.25));
        st = rot * st * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

// Paleta de 11 colores del Vuelapelucas / Pamilo Ceirone
vec3 getPamiColor(float c) {
    vec3 colors[11];
    colors[0] = vec3(239.0 / 255.0, 71.0 / 255.0, 32.0 / 255.0);
    colors[1] = vec3(255.0 / 255.0, 214.0 / 255.0, 44.0 / 255.0);
    colors[2] = vec3(34.0 / 255.0, 71.0 / 156.0, 255.0 / 255.0);
    colors[3] = vec3(245.0 / 255.0, 171.0 / 255.0, 208.0 / 255.0);
    colors[4] = vec3(4.0 / 255.0, 186.0 / 255.0, 101.0 / 255.0);
    colors[5] = vec3(197.0 / 255.0, 97.0 / 255.0, 45.0 / 255.0);
    colors[6] = vec3(15.0 / 255.0, 117.0 / 255.0, 253.0 / 255.0);
    colors[7] = vec3(0.0 / 255.0, 0.0 / 255.0, 0.0 / 255.0);
    colors[8] = vec3(154.0 / 255.0, 83.0 / 255.0, 241.0 / 255.0);
    colors[9] = vec3(108.0 / 255.0, 254.0 / 255.0, 181.0 / 255.0);
    colors[10] = vec3(254.0 / 255.0, 172.0 / 255.0, 0.0 / 255.0);

    float val = c * 10.0;
    int idx1 = int(mod(floor(val), 11.0));
    int idx2 = int(mod(floor(val + 1.0), 11.0));
    float fr = fract(val);
    return mix(colors[idx1], colors[idx2], smoothstep(0.0, 1.0, fr));
}

void main(void) {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    uv.x *= fx;

    // Velocidad y escala controladas por los uniforms
    float actualSpeed = (speed * 0.4 + 0.02) * time;
    float actualScale = (scale * 1.5 + 0.4);

    // Domain warping sutil para crear flujo suave no radial
    vec2 q = vec2(0.0);
    q.x = fbm(uv * actualScale, actualSpeed * 0.4);
    q.y = fbm(uv * actualScale + vec2(5.2, 1.3), actualSpeed * 0.4);

    vec2 r = vec2(0.0);
    r.x = fbm(uv * actualScale + 3.0 * q + vec2(1.7, 9.2), actualSpeed * 0.3);
    r.y = fbm(uv * actualScale + 3.0 * q + vec2(8.3, 2.8), actualSpeed * 0.3);

    float f = fbm(uv * actualScale + 2.5 * r, actualSpeed * 0.5);

    // Normalizar a rango 0.0 a 1.0
    float n = clamp((f + 1.0) * 0.5, 0.0, 1.0);

    // Ajuste de contraste
    n = mix(n, smoothstep(0.1, 0.9, n), contrast);

    // Mapeo a la paleta de Pamilo Ceirone
    float colorPos = fract(n + colorCycle + actualSpeed * 0.04);
    vec3 col = getPamiColor(colorPos);

    // Ajuste de brillo
    col *= (brightness * 0.8 + 0.5);

    fragColor = vec4(vec3(1.0), 1.0);
}
