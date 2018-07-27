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

    void main() {

      vec3 newPos = texture2D(positionTex, uv).xyz;
      newPos.xyz *= 5.0;
      newPos.xyz -= 2.50;

      float distance = length(newPos - cameraPos);
      gl_PointSize = min(15.0, 30.0/distance);

      float timeElapsed = uTime - startTime;
      lifeLeft = max(1.0 - ( timeElapsed / lifeTime ), 0.0);

      gl_Position = projectionMatrix * modelViewMatrix * vec4( newPos.xyz, 1.0 );
    }
  `,

  fragmentShader: `
    precision highp float;

    uniform sampler2D positionTex;

    varying float lifeLeft;

    void main() {
      vec3 vColor = vec3(1.0, 0.0, 0.4);
      gl_FragColor = vec4( lifeLeft*vColor.rgb, 1.0 );
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
    uniform vec3 ray;
    uniform vec3 origin;

    varying vec2 vUv;
    varying vec3 vVelocity;

    void main() {
      //this value later will correspond to position
      vec3 prevPos = texture2D(positionTex, vUv).xyz;
      prevPos.xyz *= 5.0;
      prevPos.xyz -= 2.50;

      float distance = 50.0/(length(cross(ray, prevPos - origin)));
      vec3 dir = normalize(prevPos-normalize(ray));
      prevPos.xyz += (vVelocity);

      vec3 newPos = prevPos;

      newPos.xyz += 2.50;
      newPos = newPos/5.0;
      gl_FragColor = vec4( newPos, 1.0);
    }
  `,
};

export default ParticleShaders;
