import * as THREE from 'three'
import { ARUtils, ARPerspectiveCamera, ARView, ARDebug } from 'three.ar.js';
import VRControls from 'three-vrcontrols-module';
import ParticleShaderAR from './ParticleShaderAR'

var vrDisplay, vrControls, arView;
var canvas, camera, scene, renderer;
var clock, mouse, raycaster ;
var CUR_INDEX = 0;
const PARTICLE_COUNT = 10000;
const COUNT_ROOT = 100;

var particleGeo, particleMat;
var computeScene, computeCamera, positionBufferTexture, positionBuffer, positionDataTex, computeMesh, computeGeo;
var computeShader;

var computeVelocityScene, computeVelocityCamera, velocityBufferTexture, velocityBuffer, velocityDataTex, computeVelocityMesh, computeVelocityGeo;
var computeVelocityShader;

/**
 * Use the `getARDisplay()` utility to leverage the WebVR API
 * to see if there are any AR-capable WebVR VRDisplays. Returns
 * a valid display if found. Otherwise, display the unsupported
 * browser message.
 */
// ARUtils.getARDisplay().then(function (display) {
//   if (display) {
//     vrDisplay = display;
//     init();
//   } else {
//     ARUtils.displayUnsupportedMessage();
//   }
// });
export default function initARScene(display) {
  vrDisplay = display;
  var arDebug = new ARDebug( vrDisplay );
  document.body.appendChild( arDebug.getElement() );
  // Setup the three.js rendering environment
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  canvas = renderer.domElement;
  document.body.appendChild(canvas);
  scene = new THREE.Scene();
  // Creating the ARView, which is the object that handles
  // the rendering of the camera stream behind the three.js
  // scene
  arView = new ARView(vrDisplay, renderer);
  // The ARPerspectiveCamera is very similar to PerspectiveCamera,
  // except when using an AR-capable browser, the camera uses
  // the projection matrix provided from the device, so that the
  // perspective camera's depth planes and field of view matches
  // the physical camera on the device.
  camera = new ARPerspectiveCamera(
    vrDisplay,
    60,
    window.innerWidth / window.innerHeight,
    vrDisplay.depthNear,
    vrDisplay.depthFar
  );
  // VRControls is a utility from three.js that applies the device's
  // orientation/position to the perspective camera, keeping our
  // real world and virtual world in sync.
  vrControls = new VRControls(camera);
  // Bind our event handlers
  window.addEventListener('resize', onWindowResize, false);

  clock = new THREE.Clock()

  //add refernce cube
  // var boxGeo = new THREE.BoxBufferGeometry( 1,1,1 );
  // var cube = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial());
  // scene.add(cube)


  //SET UP PARTICLE GEOMETRY
  particleGeo = new THREE.BufferGeometry();
  particleGeo.addAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( PARTICLE_COUNT * 2 ), 2 ).setDynamic( true ) );
  particleGeo.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( PARTICLE_COUNT * 3 ), 3 ).setDynamic( true ) );
  particleGeo.addAttribute( 'startTime', new THREE.BufferAttribute( new Float32Array( PARTICLE_COUNT ), 1 ).setDynamic( true ) );
  particleGeo.addAttribute( 'lifeTime', new THREE.BufferAttribute( new Float32Array( PARTICLE_COUNT ), 1 ).setDynamic( true ) );

  var positionAttribute = particleGeo.getAttribute( 'position' );
  var startTimeAttribute = particleGeo.getAttribute( 'startTime' );
  var lifeTimeAttribute = particleGeo.getAttribute( 'lifeTime' );
  var uvAttribute = particleGeo.getAttribute( 'uv' );

  //FILL STARTING POINT ATTRIBUTES
  for (var i = 0; i < positionAttribute.count; i++){
    positionAttribute.array[3*i] = i
    positionAttribute.array[3*i+1] = i
    positionAttribute.array[3*i+2] = i
    startTimeAttribute.array[i] = clock.getElapsedTime();
    lifeTimeAttribute.array[i] = 60; // 10 second lifetime
    uvAttribute.array[2*i] = (i%COUNT_ROOT)/COUNT_ROOT;
    uvAttribute.array[2*i+1] = Math.floor(i/COUNT_ROOT)/COUNT_ROOT;
  }

  positionAttribute.needsUpdate = true;
  startTimeAttribute.needsUpdate = true;
  lifeTimeAttribute.needsUpdate = true;

  particleMat = new THREE.ShaderMaterial( {
    // transparent: true,
    depthWrite: false,
    uniforms: {
      'uTime': {value: 0.0},
      'uScale': {value: 1.0},
      'positionTex': {value: 0.0},
      'cameraPos': {value: new THREE.Vector3()}
    },
    blending: THREE.AdditiveBlending,
    vertexShader: ParticleShaderAR.vertexShader,
    fragmentShader: ParticleShaderAR.fragmentShader
  });
  particleMat.uniforms.needsUpdate = true;
  var particleSystem = new THREE.Points( particleGeo, particleMat );
  particleSystem.frustumCulled = false;
  scene.add( particleSystem );

  //SET UP COMPUTATION VARS
  computeScene = new THREE.Scene();
  computeCamera = new THREE.Camera();
	computeCamera.position.z = 1;

  computeShader = new THREE.ShaderMaterial( {
    transparent: true,
    depthWrite: false,
    uniforms: {
      'positionTex': {value: 0.0},
      'velocityTex': {value: 0.0},
      'ray': {value: new THREE.Vector3()},
      'origin': {value: new THREE.Vector3()}
    },
    vertexShader: ParticleShaderAR.vertexComputeShader,
    fragmentShader: ParticleShaderAR.fragmentComputeShader
  } );

  //geometry is a plane with width*height segments equal to total # of particles
  computeGeo = new THREE.PlaneBufferGeometry( 2, 2, COUNT_ROOT-1, COUNT_ROOT-1 );
  computeGeo.addAttribute( 'velocity', new THREE.BufferAttribute( new Float32Array( PARTICLE_COUNT * 3 ), 3 ).setDynamic( true ) );

  //SET INITIAL COMPUTATION VARIALBES
  var velocityAttribute = computeGeo.getAttribute( 'velocity' );
  positionBuffer = new Float32Array(COUNT_ROOT * COUNT_ROOT * 4);

  for (var i = 0; i < velocityAttribute.count; i++){
    positionBuffer[4*i] = 0.0
    positionBuffer[4*i+1] = 0.0
    positionBuffer[4*i+2] = 0.0
    positionBuffer[4*i+3] = 0.1
    velocityAttribute.array[3*i] = Math.random()/40
    velocityAttribute.array[3*i+1] = Math.random()/40
    velocityAttribute.array[3*i+2] = Math.random()/40
  }

  velocityAttribute.needsUpdate = true;

  computeMesh = new THREE.Mesh( computeGeo, computeShader );
  computeScene.add(computeMesh);

  //SET UP RENDER TARGET
  positionBufferTexture = new THREE.WebGLRenderTarget(COUNT_ROOT, COUNT_ROOT, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  positionDataTex = new THREE.DataTexture(positionBuffer, COUNT_ROOT, COUNT_ROOT, THREE.RGBAFormat, THREE.FloatType);
  positionDataTex.magFilter = THREE.NearestFilter;
  positionDataTex.minFilter = THREE.NearestFilter;
  positionDataTex.needsUpdate = true;

  //UPDATE MATERIALS ON COMPUTE + PARTICLE MESH
  computeMesh.material.uniforms.positionTex.value = positionDataTex;
  particleSystem.material.uniforms.positionTex.value = positionDataTex;

  //SET UP VELOCITY COMPUTATION VARS
  computeVelocityScene = new THREE.Scene();
  computeVelocityCamera = new THREE.Camera();
  computeVelocityCamera.position.z = 1;

  computeVelocityShader = new THREE.ShaderMaterial( {
    transparent: true,
    depthWrite: false,
    uniforms: {
      'positionTex': {value: 0.0},
      'velocityTex': {value: 0.0},
      'uTime': {value: 0.0},
    },
    vertexShader: ParticleShaderAR.vertexComputeVelocityShader,
    fragmentShader: ParticleShaderAR.fragmentComputeVelocityShader
  } );

  //geometry is a plane with width*height segments equal to total # of particles
  computeVelocityGeo = new THREE.PlaneBufferGeometry( 2, 2, COUNT_ROOT-1, COUNT_ROOT-1 );

  computeVelocityMesh = new THREE.Mesh( computeVelocityGeo, computeVelocityShader );
  computeVelocityScene.add(computeVelocityMesh);

  //SET UP RENDER TARGET
  velocityBuffer = new Float32Array(COUNT_ROOT * COUNT_ROOT * 4);

  velocityBufferTexture = new THREE.WebGLRenderTarget(COUNT_ROOT, COUNT_ROOT, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  velocityDataTex = new THREE.DataTexture(velocityBuffer, COUNT_ROOT, COUNT_ROOT, THREE.RGBAFormat, THREE.FloatType);
  velocityDataTex.magFilter = THREE.NearestFilter;
  velocityDataTex.minFilter = THREE.NearestFilter;
  velocityDataTex.needsUpdate = true;

  //UPDATE MATERIALS ON COMPUTE + PARTICLE MESH
  computeVelocityMesh.material.uniforms.velocityTex.value = velocityDataTex;
  computeVelocityMesh.material.uniforms.positionTex.value = positionDataTex;
  computeMesh.material.uniforms.velocityTex.value = velocityDataTex;

  update();
}

function spawnParticle(position, worldDir){
  var i = CUR_INDEX;

  //SET INITIAL VARIABLES FOR PARTICLE MAT
  var startTimeAttribute = particleGeo.getAttribute( 'startTime' );
  var lifeTimeAttribute = particleGeo.getAttribute( 'lifeTime' );

  startTimeAttribute.array[i] = clock.getElapsedTime();
  lifeTimeAttribute.array[i] = 60;

  startTimeAttribute.needsUpdate = true;
  lifeTimeAttribute.needsUpdate = true;

  //SET INITIAL VARIABLES FOR COMPUTE SHADER
  var buf = positionDataTex.image.data;
  buf[4*i] = position.x
  buf[4*i+1] = position.y
  buf[4*i+2] = position.z
  positionDataTex.needsUpdate = true;

  var velbuf = velocityDataTex.image.data;
  velbuf[4*i] = worldDir.x/50
  velbuf[4*i+1] = worldDir.x/50
  velbuf[4*i+2] = worldDir.x/50
  velocityDataTex.needsUpdate = true;

  CUR_INDEX += 1;
  if( CUR_INDEX >= PARTICLE_COUNT) {
    CUR_INDEX = 0;
  }
}

/**
 * The render loop, called once per frame. Handles updating
 * our scene and rendering.
 */
function update() {
  // Clears color from the frame before rendering the camera (arView) or scene.
  renderer.clearColor();
  // Render the device's camera stream on screen first of all.
  // It allows to get the right pose synchronized with the right frame.
  arView.render();
  // Update our camera projection matrix in the event that
  // the near or far planes have updated
  camera.updateProjectionMatrix();
  // Update our perspective camera's positioning
  vrControls.update();
  // If we have not added boxes yet, and we have positional
  // information applied to our camera (it can take a few seconds),
  // and the camera's Y position is not undefined or 0, create boxes
  // Render our three.js virtual scene
  renderer.clearDepth();

  renderer.render(computeVelocityScene, computeVelocityCamera, velocityBufferTexture);
  renderer.readRenderTargetPixels(velocityBufferTexture, 0, 0, COUNT_ROOT, COUNT_ROOT, velocityBuffer);
  velocityDataTex.image.data = velocityBuffer;
  velocityDataTex.needsUpdate = true;

  renderer.render(computeScene, computeCamera, positionBufferTexture);
  renderer.readRenderTargetPixels(positionBufferTexture, 0, 0, COUNT_ROOT, COUNT_ROOT, positionBuffer);
  positionDataTex.image.data = positionBuffer;
  positionDataTex.needsUpdate = true;
  renderer.render(scene, camera);
  // renderer.render(computeScene, computeCamera);

  for (var i = 0; i < 30; i ++) {
    //for now , all initial positions are at the origin
    // var x = (camera.position.x+2.5)/5;
    // var y = (camera.position.y+2.5)/5;
    // var z = (camera.position.z+2.5)/5;
    // console.log(x, y, z);
    // var newPos = new THREE.Vector3(x, y, z);

    var worldDir = new THREE.Vector3();
    camera.getWorldDirection(worldDir);
    worldDir.normalize();
    // var right = new THREE.Vector3(-1,0,0);
    // right.applyMatrix4(camera.matrixWorldInverse);
    //
    // var down = new THREE.Vector3(0,-1,0);
    // down.applyMatrix4(camera.matrixWorldInverse);

    var x = (0.1*Math.random() + camera.position.x + 0.5*worldDir.x +2.5)/5;
    var y = (0.1*Math.random() + camera.position.y + 0.5*worldDir.y +2.5)/5;
    var z = (0.1*Math.random() + camera.position.z + 0.5*worldDir.z +2.5)/5;
    var newPos = new THREE.Vector3(x,y,z);

    // var x = (0.1*Math.random() + 0.05*down.x +  0.05*right.x + camera.position.x+2.5)/5;
    // var y = (0.1*Math.random() + 0.05*down.y + 0.05*right.y + camera.position.y+2.5)/5;
    // var z = (0.1*Math.random() + 0.05*down.z + 0.05*right.z + camera.position.z+2.5)/5;
    // var newPos = new THREE.Vector3(x,y,z);

    // newPos.x += Math.cos(clock.getElapsedTime()/2)/400;
    // newPos.z += Math.sin(clock.getElapsedTime()/2)/400;


    // var x = (Math.random() + camera.position.x+2.5)/5;
    // var y = (Math.random() + camera.position.y+2.5)/5;
    // var z = (Math.random() + camera.position.z+2.5)/5;
    // var newPos = new THREE.Vector3(x,y,z);

    spawnParticle(newPos, worldDir)
  }

  var worldDir = new THREE.Vector3();
  camera.getWorldDirection(worldDir);

  computeMesh.material.uniforms.ray.value = worldDir;
  computeMesh.material.uniforms.origin.value = camera.position.clone()
  particleMat.uniforms.uTime.value = clock.getElapsedTime();
  particleMat.uniforms.cameraPos.value = camera.position.clone();
  computeVelocityMesh.material.uniforms.uTime.value += 0.001;

  // Kick off the requestAnimationFrame to call this function
  // when a new VRDisplay frame is rendered
  vrDisplay.requestAnimationFrame(update);
}
/**
 * On window resize, update the perspective camera's aspect ratio,
 * and call `updateProjectionMatrix` so that we can get the latest
 * projection matrix provided from the device
 */
function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
