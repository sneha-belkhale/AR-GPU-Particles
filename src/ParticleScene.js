import * as THREE from 'three'
import ParticleShaders from './ParticleShaders'

var OrbitControls = require('three-orbit-controls')(THREE)

var scene, camera, controls, renderer, clock, mouse, raycaster ;
var CUR_INDEX = 0;
const PARTICLE_COUNT = 10000;

var particleGeo, particleMat;
var computeScene, computeCamera, positionBufferTexture, positionBuffer, positionDataTex, computeMesh, computeGeo;
var computeShader;

function init() {
  //initialize scene
  scene = new THREE.Scene();
  //initialize camera
  camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.0001, 100000 );
  camera.position.z = 10;
  //set up orbit controls on the camera
  controls = new OrbitControls(camera);
  //initialize renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  //add renderer to the html page
  document.body.appendChild( renderer.domElement );

  clock = new THREE.Clock()

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
    lifeTimeAttribute.array[i] = 10; // 10 second lifetime
    uvAttribute.array[2*i] = (i%100)/100;
    uvAttribute.array[2*i+1] = Math.floor(i/100)/100;
  }

  positionAttribute.needsUpdate = true;
  startTimeAttribute.needsUpdate = true;
  lifeTimeAttribute.needsUpdate = true;

  particleMat = new THREE.ShaderMaterial( {
    transparent: true,
    depthWrite: false,
    uniforms: {
      'uTime': {value: 0.0},
      'uScale': {value: 1.0},
      'positionTex': {value: 0.0},
    },
    blending: THREE.AdditiveBlending,
    vertexShader: ParticleShaders.vertexShader,
    fragmentShader: ParticleShaders.fragmentShader
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
      'ray': {value: new THREE.Vector3()},
      'origin': {value: new THREE.Vector3()}
    },
    vertexShader: ParticleShaders.vertexComputeShader,
    fragmentShader: ParticleShaders.fragmentComputeShader
  } );

  //geometry is a plane with width*height segments equal to total # of particles
  computeGeo = new THREE.PlaneBufferGeometry( 2, 2, 99, 99 );
  computeGeo.addAttribute( 'velocity', new THREE.BufferAttribute( new Float32Array( PARTICLE_COUNT * 3 ), 3 ).setDynamic( true ) );

  //SET INITIAL COMPUTATION VARIALBES
  var velocityAttribute = computeGeo.getAttribute( 'velocity' );
  positionBuffer = new Float32Array(100 * 100 * 4);

  for (var i = 0; i < velocityAttribute.count; i++){
    positionBuffer[4*i] = Math.random()/5
    positionBuffer[4*i+1] = 0.0
    positionBuffer[4*i+2] = Math.random()/5
    positionBuffer[4*i+3] = 0.1
    velocityAttribute.array[3*i] = Math.random();
    velocityAttribute.array[3*i+1] = Math.random();
    velocityAttribute.array[3*i+2] = Math.random();
  }

  velocityAttribute.needsUpdate = true;

  computeMesh = new THREE.Mesh( computeGeo, computeShader );
  computeScene.add(computeMesh);

  //SET UP RENDER TARGET
  positionBufferTexture = new THREE.WebGLRenderTarget(100, 100, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  positionDataTex = new THREE.DataTexture(positionBuffer, 100, 100, THREE.RGBAFormat, THREE.FloatType);
  positionDataTex.magFilter = THREE.NearestFilter;
  positionDataTex.minFilter = THREE.NearestFilter;
  positionDataTex.needsUpdate = true;

  //UPDATE MATERIALS ON COMPUTE + PARTICLE MESH
  computeMesh.material.uniforms.positionTex.value = positionDataTex;
  particleSystem.material.uniforms.positionTex.value = positionDataTex;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2()
  document.addEventListener('mousemove', onDocumentMouseMove, false);

  update();
}

function onDocumentMouseMove(event) {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function spawnParticle(position){
  var i = CUR_INDEX;

  //SET INITIAL VARIABLES FOR PARTICLE MAT
  var startTimeAttribute = particleGeo.getAttribute( 'startTime' );
  var lifeTimeAttribute = particleGeo.getAttribute( 'lifeTime' );

  startTimeAttribute.array[i] = clock.getElapsedTime();
  lifeTimeAttribute.array[i] = 10;

  startTimeAttribute.needsUpdate = true;
  lifeTimeAttribute.needsUpdate = true;

  //SET INITIAL VARIABLES FOR COMPUTE SHADER
  var buf = positionDataTex.image.data;
  buf[4*i] = position.x
  buf[4*i+1] = position.y
  buf[4*i+2] = position.z
  positionDataTex.needsUpdate = true;

  var velocityAttribute = computeGeo.getAttribute( 'velocity' );
  velocityAttribute.array[3*i] = Math.random();
  velocityAttribute.array[3*i+1] = Math.random();
  velocityAttribute.array[3*i+2] = Math.random();

  CUR_INDEX += 1;
  if( CUR_INDEX >= PARTICLE_COUNT) {
    CUR_INDEX = 0;
  }
}

function update() {
    renderer.clear()
    renderer.render(computeScene, computeCamera, positionBufferTexture);
    renderer.readRenderTargetPixels(positionBufferTexture, 0, 0, 100, 100, positionBuffer);
    positionDataTex.image.data = positionBuffer;
    positionDataTex.needsUpdate = true;
    renderer.render(scene, camera);
    // renderer.render(computeScene, computeCamera);

    requestAnimationFrame(update);
    for (var i = 0; i < 10; i ++) {
      //for now , all initial positions are at the origin
      var newPos = new THREE.Vector3(0.01,0.01,0.01);
      spawnParticle(newPos)
    }

    raycaster.setFromCamera(mouse, camera);
    //UPDATE COMPUTE MAT WITH MOUSE POS
    computeMesh.material.uniforms.ray.value = raycaster.ray.direction.clone()
    computeMesh.material.uniforms.origin.value = raycaster.ray.origin.clone()
    particleMat.uniforms.uTime.value = clock.getElapsedTime();
}

init();
