/* DeepSeek homepage hero background, adapted from the live official chunks
   (8261 page fluid defaults + 8226 six-color fluid shader with grain). */
(function () {
  'use strict'

  const VERTEX = `#version 300 es
in vec4 a_position;
out vec2 vUv;
void main() { vUv = a_position.xy * 0.5 + 0.5; gl_Position = a_position; }`

  const FRAGMENT_THREE = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1, u_color2, u_color3;
uniform float u_colorCount;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;
uniform vec2 u_offset;
out vec4 fragColor;
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
vec2 rotate(vec2 uv, float th) { return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv; }
float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
float noise(vec2 st) {
  vec2 i = floor(st); vec2 f = fract(st); float a = random(i), b = random(i + vec2(1,0));
  vec2 u = f*f*(3.0-2.0*f); float c = random(i + vec2(0,1)), d = random(i + vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
vec3 blend_multi(float mixer, float softness) {
  float edge = 1.0 - softness; vec3 col = u_color1.rgb;
  if (u_colorCount > 1.5) col = mix(col, u_color2.rgb, smoothstep(.35*edge, .7-.35*edge, mixer));
  if (u_colorCount > 2.5) col = mix(col, u_color3.rgb, smoothstep(.3+.35*edge, 1.-.35*edge, mixer));
  return col;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy; float t = .5 * u_time;
  float ns = .0005 + .006 * u_scale; uv -= .5; uv *= ns * u_resolution;
  uv = rotate(uv, u_rotation * .5 * PI); uv /= u_pixelRatio; uv += .5; uv += u_offset;
  float n1 = noise(uv + t), n2 = noise(uv * 2. - t), angle = n1 * TWO_PI;
  uv.x += 4. * u_distortion * n2 * cos(angle); uv.y += 4. * u_distortion * n2 * sin(angle);
  float iters = ceil(clamp(u_swirlIterations, 1., 30.));
  for (float i = 1.; i <= 30.; i++) { if (i > iters) break;
    uv.x += u_swirl / i * cos(t + i*1.5*uv.y); uv.y += u_swirl / i * cos(t + i*uv.x);
  }
  vec2 cuv = uv * (.5 + 3.5 * u_shapeScale);
  float shape = .5 + .5 * sin(cuv.x) * cos(cuv.y);
  float mixer = shape + .48 * sign(u_proportion - .5) * pow(abs(u_proportion - .5), .5);
  fragColor = vec4(blend_multi(mixer, clamp(u_softness, 0., 1.)), 1.0);
}`

  const FRAGMENT_SIX = `#version 300 es
precision mediump float;
uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform vec4 u_color4;
uniform vec4 u_color5;
uniform vec4 u_color6;
uniform float u_colorCount;
uniform float u_grain;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;
uniform vec2 u_offset;
out vec4 fragColor;
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
vec2 rotate(vec2 uv, float th) { return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv; }
float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
float noise(vec2 st) {
  vec2 i = floor(st); vec2 f = fract(st);
  float a = random(i); float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 blend_multi(float mixer, float softness) {
  float edge = 1.0 - softness;
  vec3 col = u_color1.rgb;
  if (u_colorCount > 1.5) col = mix(col, u_color2.rgb, smoothstep(0.0 + 0.35 * edge, 0.7 - 0.35 * edge, mixer));
  if (u_colorCount > 2.5) col = mix(col, u_color3.rgb, smoothstep(0.3 + 0.35 * edge, 1.0 - 0.35 * edge, mixer));
  if (u_colorCount > 3.5) col = mix(col, u_color4.rgb, smoothstep(0.4, 0.75, mixer));
  if (u_colorCount > 4.5) col = mix(col, u_color5.rgb, smoothstep(0.55, 0.85, mixer));
  if (u_colorCount > 5.5) col = mix(col, u_color6.rgb, smoothstep(0.7, 0.95, mixer));
  return col;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = .5 * u_time;
  float noise_scale = .0005 + .006 * u_scale;
  uv -= .5;
  uv *= (noise_scale * u_resolution);
  uv = rotate(uv, u_rotation * .5 * PI);
  uv /= u_pixelRatio;
  uv += .5;
  uv += u_offset;
  float n1 = noise(uv * 1. + t);
  float n2 = noise(uv * 2. - t);
  float angle = n1 * TWO_PI;
  uv.x += 4. * u_distortion * n2 * cos(angle);
  uv.y += 4. * u_distortion * n2 * sin(angle);
  float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
  for (float i = 1.; i <= 30.0; i++) {
    if (i > iterations_number) break;
    uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
    uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
  }
  float proportion = clamp(u_proportion, 0., 1.);
  vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
  float shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
  float mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
  vec3 col = blend_multi(mixer, clamp(u_softness, 0., 1.));
  fragColor = vec4(col, 1.0);
  if (u_grain > 0.0) {
    float g = random(gl_FragCoord.xy + vec2(u_time * 100.0));
    fragColor.rgb += (g - 0.5) * u_grain;
  }
}`

  function rgb(hex) {
    const value = hex.replace('#', '')
    return [parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255]
  }

  function compile(gl, type, source) {
    const result = gl.createShader(type)
    gl.shaderSource(result, source)
    gl.compileShader(result)
    return gl.getShaderParameter(result, gl.COMPILE_STATUS) ? result : null
  }

  const FRAGMENT_FLUID = `#version 300 es
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_c1, u_c2, u_c3, u_c4, u_c5;
uniform float u_scale;
uniform float u_grain;
out vec4 fragColor;
vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float hash(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
float fbm(vec3 p){
  float v=0.,amp=.6;vec3 shift=vec3(100.);
  for(int i=0;i<1;i++){v+=amp*snoise(p);p=p*2.+shift;amp*=.4;}
  return v;
}
float fluidNoise(vec2 uv,float t){
  float n1=fbm(vec3(uv*.6,t*.06));
  float n2=fbm(vec3(uv*.6+5.2,t*.06+1.3));
  vec2 w1=vec2(n1,n2)*.6;
  float n3=fbm(vec3((uv+w1)*.7+1.7,t*.05+3.1));
  float n4=fbm(vec3((uv+w1)*.7+9.2,t*.05+5.7));
  vec2 w2=vec2(n3,n4)*.5;
  return fbm(vec3((uv+w1+w2)*.5,t*.04));
}
vec2 curlish(vec2 uv,float t){
  float eps=.02;
  float n=snoise(vec3(uv*.8,t));
  float nx=snoise(vec3((uv+vec2(eps,0.))*.8,t));
  float ny=snoise(vec3((uv+vec2(0.,eps))*.8,t));
  return vec2(-(ny-n)/eps,(nx-n)/eps)*.003;
}
void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 uv=gl_FragCoord.xy/u_resolution;
  vec2 suv=vec2(uv.x*aspect, uv.y) * u_scale;
  float t=u_time;
  vec2 curl=curlish(suv,t*.04);
  vec2 uvD=suv+curl*12.;
  float f=fluidNoise(uvD,t);
  float swirl=snoise(vec3(uvD*.8+f*1.5,t*.035))*.5+.5;
  float n=f*.5+.5;
  vec3 col=mix(u_c1,u_c2,smoothstep(.2,.5,n));
  col=mix(col,u_c3,smoothstep(.35,.65,n+swirl*.25));
  col=mix(col,u_c4,smoothstep(.6,.85,swirl)*.55);
  col=mix(col,u_c5,smoothstep(.5,.8,n*swirl)*.35);
  if(u_grain>0.0){
    vec2 flowOffset=(uvD-suv)*u_resolution.y;
    vec2 gp=floor((gl_FragCoord.xy+flowOffset)/5.0);
    float gr=hash(gp)*2.-1.;
    col+=gr*u_grain;
  }
  float vig=1.-smoothstep(.4,.78,length(uv-.5));
  col=mix(col*.75,col,vig*.35+.65);
  fragColor=vec4(col,1.);
}`

  function initFlow(canvas, options) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' })
    if (!gl) return
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragShader = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_FLUID)
    if (!vertex || !fragShader) return
    const program = gl.createProgram()
    gl.attachShader(program, vertex); gl.attachShader(program, fragShader); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const attr = gl.getAttribLocation(program, 'a_position')
    const u = {
      time: gl.getUniformLocation(program, 'u_time'),
      res: gl.getUniformLocation(program, 'u_resolution'),
      scale: gl.getUniformLocation(program, 'u_scale'),
      grain: gl.getUniformLocation(program, 'u_grain'),
      c: [1, 2, 3, 4, 5].map(i => gl.getUniformLocation(program, 'u_c' + i)),
    }
    const palette = options.colors.slice(0, 5).map(rgb)
    const started = performance.now()
    let last = 0
    function draw(now) {
      requestAnimationFrame(draw)
      if (now - last < 1000 / 30) return
      last = now
      const width = Math.max(1, canvas.clientWidth); const height = Math.max(1, canvas.clientHeight)
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      gl.viewport(0, 0, width, height); gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0)
      gl.uniform1f(u.time, (performance.now() - started) * .001 * (options.speed / 100))
      gl.uniform2f(u.res, width, height)
      gl.uniform1f(u.scale, options.scale)
      gl.uniform1f(u.grain, options.grain || 0)
      palette.forEach((value, index) => gl.uniform3f(u.c[index], value[0], value[1], value[2]))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    requestAnimationFrame(draw)
  }

  function initFluid(canvas, fragment, options) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' })
    if (!gl) return
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragShader = compile(gl, gl.FRAGMENT_SHADER, fragment)
    if (!vertex || !fragShader) return
    const program = gl.createProgram()
    gl.attachShader(program, vertex); gl.attachShader(program, fragShader); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const attr = gl.getAttribLocation(program, 'a_position')
    const names = ['u_time', 'u_pixelRatio', 'u_resolution', 'u_scale', 'u_rotation', 'u_color1', 'u_color2', 'u_color3', 'u_color4', 'u_color5', 'u_color6', 'u_colorCount', 'u_grain', 'u_proportion', 'u_softness', 'u_shape', 'u_shapeScale', 'u_distortion', 'u_swirl', 'u_swirlIterations', 'u_offset']
    const uniforms = {}
    names.forEach(name => { uniforms[name] = gl.getUniformLocation(program, name) })
    const palette = Array.from({ length: 6 }, (_, index) => options.colors[index] ? rgb(options.colors[index]) : [0, 0, 0])
    const started = performance.now()
    function resize() {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = Math.max(1, Math.round(rect.width * dpr))
      const height = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      return [width, height, dpr]
    }
    function draw() {
      const [width, height, dpr] = resize()
      gl.viewport(0, 0, width, height); gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0)
      gl.uniform1f(uniforms.u_time, (performance.now() - started) * .001 * (options.speed / 100))
      gl.uniform1f(uniforms.u_pixelRatio, dpr); gl.uniform2f(uniforms.u_resolution, width, height)
      gl.uniform1f(uniforms.u_scale, options.scale); gl.uniform1f(uniforms.u_rotation, options.rotation / 90)
      palette.forEach((value, index) => { gl.uniform4f(uniforms['u_color' + (index + 1)], value[0], value[1], value[2], 1) })
      gl.uniform1f(uniforms.u_colorCount, options.colors.length)
      if (uniforms.u_grain) gl.uniform1f(uniforms.u_grain, options.grain || 0)
      gl.uniform1f(uniforms.u_proportion, options.proportion / 100)
      gl.uniform1f(uniforms.u_softness, options.softness / 100)
      if (uniforms.u_shape) gl.uniform1f(uniforms.u_shape, 0)
      gl.uniform1f(uniforms.u_shapeScale, options.shapeScale / 100)
      gl.uniform1f(uniforms.u_distortion, options.distortion / 100)
      gl.uniform1f(uniforms.u_swirl, options.swirl / 50)
      gl.uniform1f(uniforms.u_swirlIterations, options.swirlIterations)
      gl.uniform2f(uniforms.u_offset, options.offsetX / 100, options.offsetY / 100)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      requestAnimationFrame(draw)
    }
    requestAnimationFrame(draw)
  }

  function initGrid(canvas) {
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let particles = [], cols = 0, rows = 0, width = 0, height = 0
    const mouse = { x: NaN, y: NaN }
    function setup() {
      width = canvas.clientWidth; height = canvas.clientHeight; if (!width || !height) return false
      const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(width / 90) + 1; rows = Math.ceil(height / 90) + 1
      const offsetX = (width - (cols - 1) * 90) / 2; const offsetY = (height - (rows - 1) * 90) / 2; particles = []
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const px = offsetX + x * 90; const py = offsetY + y * 90; particles.push({ restX: px, restY: py, x: px, y: py, vx: 0, vy: 0 }) }
      return true
    }
    function draw(interactive) {
      ctx.clearRect(0, 0, width, height); ctx.strokeStyle = 'rgba(70, 110, 175, .13)'; ctx.lineWidth = .5
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols - 1; x++) line(particles[y * cols + x], particles[y * cols + x + 1])
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows - 1; y++) line(particles[y * cols + x], particles[(y + 1) * cols + x])
      ctx.fillStyle = 'rgba(70, 110, 175, .24)'; for (const point of particles) { let radius = 1.8; let alpha = .24
        if (interactive && !Number.isNaN(mouse.x)) { const dx = point.x - mouse.x; const dy = point.y - mouse.y; const influence = Math.max(0, 1 - Math.hypot(dx, dy) / 140); radius += 2 * influence; alpha += .4 * influence }
        ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill()
      } ctx.globalAlpha = 1
    }
    function line(a, b) { const dx = b.x - a.x; const dy = b.y - a.y; const distance = Math.hypot(dx, dy); if (distance < 20) return; const ux = dx / distance; const uy = dy / distance; ctx.beginPath(); ctx.moveTo(a.x + 10 * ux, a.y + 10 * uy); ctx.lineTo(b.x - 10 * ux, b.y - 10 * uy); ctx.stroke() }
    if (!setup()) { requestAnimationFrame(() => { if (setup()) draw(false) }); return }
    draw(false)
    function trackMouse(event) { const rect = canvas.getBoundingClientRect(); mouse.x = event.clientX - rect.left; mouse.y = event.clientY - rect.top }
    window.addEventListener('mousemove', trackMouse)
    window.addEventListener('resize', () => { if (setup()) draw(false) })
    let last = 0
    function animate(now) { if (now - last < 1000 / 30) { requestAnimationFrame(animate); return } last = now
      let velocity = 0; for (const point of particles) { if (!Number.isNaN(mouse.x)) { const dx = point.x - mouse.x; const dy = point.y - mouse.y; const distance = Math.hypot(dx, dy); if (distance < 140 && distance > .1) { const force = (1 - distance / 140) * 30; point.vx += dx / distance * force * .1; point.vy += dy / distance * force * .1 } }
        point.vx += .05 * (point.restX - point.x); point.vy += .05 * (point.restY - point.y); point.vx *= .85; point.vy *= .85; point.x += point.vx; point.y += point.vy; velocity = Math.max(velocity, Math.abs(point.vx) + Math.abs(point.vy)) }
      draw(true); if (velocity > .01 || !Number.isNaN(mouse.x)) requestAnimationFrame(animate)
    }
    window.addEventListener('mousemove', () => requestAnimationFrame(animate))
  }

  function initCursor() {
    const ring = document.querySelector('.cursor-ring')
    if (!ring) return
    let targetX = 0, targetY = 0, x = 0, y = 0, visible = false
    window.addEventListener('mousemove', (event) => {
      targetX = event.clientX; targetY = event.clientY
      if (!visible) { visible = true; ring.style.opacity = '1'; x = targetX; y = targetY }
      const blend = event.target.closest ? event.target.closest('[data-cursor="blend"]') : null
      ring.classList.toggle('is-blend', Boolean(blend))
    })
    document.addEventListener('mouseleave', () => { visible = false; ring.style.opacity = '0' })
    function follow() {
      const ease = Math.hypot(targetX - x, targetY - y) < 50 ? .7 : .4
      x += (targetX - x) * ease; y += (targetY - y) * ease
      ring.style.transform = `translate3d(${x}px, ${y}px, 0)`
      requestAnimationFrame(follow)
    }
    requestAnimationFrame(follow)
  }

  function start() {
    const background = document.querySelector('.hero-fluid-canvas')
    const grid = document.querySelector('.hero-grid-canvas')
    const card = document.querySelector('.product-card-ink')
    if (background) initFluid(background, FRAGMENT_THREE, {
      colors: ['#8AA3D6', '#FFFFFF', '#FFFFFF'],
      speed: 14, scale: .5, rotation: -5, proportion: 50, softness: 100,
      shapeScale: 10, distortion: 20, swirl: 12, swirlIterations: 8, offsetX: 0, offsetY: 65,
    })
    if (grid) initGrid(grid)
    if (card) initFlow(card, {
      colors: ['#0A1A3A', '#1A3870', '#2D5F9E', '#4A8AC4', '#0D1F4A'],
      grain: .003, speed: 80, scale: 2.5,
    })
    initCursor()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
}())
