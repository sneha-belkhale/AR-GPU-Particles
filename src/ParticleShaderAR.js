const shaderPartialSimplexNoise= `
//	Simplex 3D Noise
//	by Ian McEwan, Ashima Arts
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}`;

    // From: https://github.com/cabbibo/glsl-curl-noise
const shaderPartialCurlNoise= `
${shaderPartialSimplexNoise}

vec3 snoiseVec3( vec3 x ){
  float s  = snoise(vec3( x ));
  float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
  float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
  vec3 c = vec3( s , s1 , s2 );
  return c;
}

vec3 s( vec3 p, float angle){
  const float e = .1;
  float sin_t = sin(angle);
  float cos_t = cos(angle);

  vec3 dx = vec3( e   , 0.0 , 0.0 );
  vec3 dy = vec3( 0.0 , e   , 0.0 );
  vec3 dz = vec3( 0.0 , 0.0 , e   );

  vec3 p_x0 = snoiseVec3( p - dx );
  vec3 p_x1 = snoiseVec3( p + dx );
  vec3 p_y0 = snoiseVec3( p - dy );
  vec3 p_y1 = snoiseVec3( p + dy );
  vec3 p_z0 = snoiseVec3( p - dz );
  vec3 p_z1 = snoiseVec3( p + dz );

  float x = sin_t*(p_y1.z - p_y0.z)  - cos_t*(p_z1.y - p_z0.y);
  float y = sin_t*(p_z1.x - p_z0.x)  - cos_t*(p_x1.z - p_x0.z);
  float z = sin_t*(p_x1.y - p_x0.y)  - cos_t*(p_y1.x - p_y0.x);

  const float divisor = 1.0 / ( 2.0 * e );
  return normalize( vec3( x , y , z ) * divisor );
}`;
const ParticleShaders = {
  vertexShader: `
    precision highp float;

    attribute float startTime;
    attribute float lifeTime;

    uniform float uTime;
    uniform float uScale;
    uniform vec3 cameraPos;
    uniform sampler2D positionTex;

    varying float lifeLeft;
    varying vec3 vPos;

    void main() {

      vec3 newPos = texture2D(positionTex, uv).xyz;
      newPos.xyz *= 5.0;
      newPos.xyz -= 2.50;

      float distance = length(newPos - cameraPos);
      gl_PointSize = min(10.0, 10.0/distance);

      float timeElapsed = uTime - startTime;
      lifeLeft = max(1.0 - ( timeElapsed / lifeTime ), 0.0);

      vPos = newPos.xyz;

      gl_Position = projectionMatrix * modelViewMatrix * vec4( newPos.xyz, 1.0 );
    }
  `,

  fragmentShader: `
    precision highp float;

    uniform sampler2D positionTex;
    uniform sampler2D particleSpriteTex;

    varying float lifeLeft;
    varying vec3 vPos;

    void main() {
      vec3 vColor = normalize(vPos);
      vec4 spriteColor = texture2D( particleSpriteTex, gl_PointCoord);

      gl_FragColor = vec4((1.0 - vPos), 1.0 );
    }
  `,
  vertexComputeShader: `
    precision highp float;

    attribute vec3 velocity;

    varying vec3 vVelocity;
    varying vec2 vUv;

    void main() {
      vVelocity = velocity;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentComputeShader: `
    precision highp float;

    uniform sampler2D positionTex;
    uniform sampler2D velocityTex;

    uniform vec3 ray;
    uniform vec3 origin;

    varying vec2 vUv;
    varying vec3 vVelocity;

    void main() {
      //this value later will correspond to position
      vec3 prevPos = texture2D(positionTex, vUv).xyz;
      vec3 velocity = texture2D(velocityTex, vUv).xyz;

      prevPos.xyz *= 5.0;
      prevPos.xyz -= 2.50;

      float distance = 50.0/(length(cross(ray, prevPos - origin)));
      vec3 dir = normalize(prevPos-normalize(ray));
      prevPos.xyz += (velocity);

      vec3 newPos = prevPos;

      newPos.xyz += 2.50;
      newPos = newPos/5.0;
      gl_FragColor = vec4( newPos, 1.0);
    }
  `,
  vertexComputeVelocityShader: `
    precision highp float;
    uniform sampler2D velocityTex;

    varying vec2 vUv;
    varying vec3 vVelocity;

    void main() {
      vUv = uv;
      vVelocity = texture2D(velocityTex, vUv).xyz;

      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentComputeVelocityShader: `
    ${shaderPartialCurlNoise}

    precision highp float;

    uniform sampler2D positionTex;
    uniform sampler2D velocityTex;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vVelocity;

    void main() {
      //this value later will correspond to position
      vec3 prevPos = texture2D(positionTex, vUv).xyz;
      vec3 velocity = texture2D(velocityTex, vUv).xyz;

      prevPos.xyz *= 5.0;
      prevPos.xyz -= 2.50;


      vec3 curlVelocity = 0.005*s(prevPos, uTime) + 0.01*velocity + 0.001*vec3(1.0,0,0);

      gl_FragColor = vec4( curlVelocity, 1.0);
    }
  `,
};

export default ParticleShaders;
