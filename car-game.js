// ============================================================
//  3D AUTOMATED OBSTACLE CAR GAME (Three.js + 2D HUD)
//  Autonomous Stunt Driver | 8 Dynamic Obstacle Types
//  Adaptive Duration (20s - 300s) | Frame-accurate Sound FX
// ============================================================

class CarObstacleGame {
  constructor(container, options = {}) {
    this.container = container;
    this.width = options.width || 1080;
    this.height = options.height || 1920;
    this.duration = options.duration || 45; // seconds
    this.seed = options.seed || Date.now();
    this.isAutoMode = options.autoMode || false;

    // Game State
    this.timer = 0;
    this.totalFrames = this.duration * 60; // 60fps simulation
    this.speed = 1.2; // Base speed
    this.maxSpeed = 3.2;
    this.currentSpeed = 1.2;
    this.targetSpeed = 1.8;
    this.distance = 0;
    this.score = 0;
    this.combo = 1;
    this.lastScoreTime = 0;
    this.activeBadges = []; // [{ text, sub, color, life, maxLife }]
    this.isFinished = false;
    this.finishTimer = 0;

    // Lane config (5 lanes: -10, -5, 0, 5, 10)
    this.numLanes = 5;
    this.laneWidth = 5.0;
    this.lanes = [-10, -5, 0, 5, 10];
    this.currentLane = 2; // Center lane (0)
    this.carX = 0;
    this.carTargetX = 0;
    this.carY = 0;
    this.carTargetY = 0;
    this.carZ = 0;
    this.carRoll = 0;
    this.carPitch = 0;
    this.carYaw = 0;
    this.steeringVel = 0;

    // Air / Jump physics
    this.isAirborne = false;
    this.verticalVel = 0;
    this.jumpSpin = 0;

    // Nitro state
    this.isNitro = false;
    this.nitroTimer = 0;

    // Sound Events array
    this.soundEvents = [];

    // Initialize RNG from seed
    this.rngSeed = this.seed;

    // Three.js instances
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.carGroup = null;
    this.wheels = [];
    this.headlights = [];
    this.exhaustParticles = [];
    this.roadSegments = [];
    this.obstacles = [];
    this.pickups = [];
    this.finishLineMesh = null;
    this.megaRampMesh = null;

    // HUD Canvas
    this.hudCanvas = null;
    this.hudCtx = null;

    this.init();
  }

  pseudoRandom() {
    this.rngSeed = (this.rngSeed * 9301 + 49297) % 233280;
    return this.rngSeed / 233280;
  }

  init() {
    this.setupThreeJS();
    this.setupRoad();
    this.setupCar();
    this.setupObstacles();
    this.setupHUD();
  }

  // ======================== THREE.JS SETUP ========================
  setupThreeJS() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814);
    this.scene.fog = new THREE.FogExp2(0x080b1e, 0.007);

    this.camera = new THREE.PerspectiveCamera(65, this.width / this.height, 0.5, 600);
    this.camera.position.set(0, 7.5, 15);
    this.camera.lookAt(0, 2, -15);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'three-canvas';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404870, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    dirLight.position.set(20, 45, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 120;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    this.scene.add(dirLight);

    // Cyberpunk neon point lights along course
    const neonCyan = new THREE.PointLight(0x00f0ff, 2.0, 60);
    neonCyan.position.set(-14, 8, -30);
    this.scene.add(neonCyan);

    const neonMagenta = new THREE.PointLight(0xff0066, 2.0, 60);
    neonMagenta.position.set(14, 8, -70);
    this.scene.add(neonMagenta);
  }

  // ======================== ROAD & SCENERY ========================
  setupRoad() {
    const roadWidth = 32;
    const segLength = 400;

    // Modular road segments that recycle as car moves
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x11131c,
      roughness: 0.8,
      metalness: 0.2
    });

    for (let i = 0; i < 4; i++) {
      const roadGeo = new THREE.PlaneGeometry(roadWidth, segLength);
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.z = -i * segLength;
      road.receiveShadow = true;
      this.scene.add(road);
      this.roadSegments.push(road);
    }

    // Neon Guardrails
    const railMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const railMatPink = new THREE.MeshBasicMaterial({ color: 0xff0077 });

    const railGeo = new THREE.BoxGeometry(0.8, 1.6, 1600);
    const leftRail = new THREE.Mesh(railGeo, railMatCyan);
    leftRail.position.set(-roadWidth / 2 - 0.4, 0.8, -800);
    this.scene.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railMatPink);
    rightRail.position.set(roadWidth / 2 + 0.4, 0.8, -800);
    this.scene.add(rightRail);

    // Glowing Lane Dividers
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
    for (let l = 1; l < this.numLanes; l++) {
      const lx = -roadWidth / 2 + l * (roadWidth / this.numLanes);
      for (let z = 0; z > -1600; z -= 14) {
        const stripeGeo = new THREE.BoxGeometry(0.25, 0.05, 6);
        const stripe = new THREE.Mesh(stripeGeo, lineMat);
        stripe.position.set(lx, 0.03, z);
        this.scene.add(stripe);
      }
    }

    // Grid terrain outside road
    const gridHelper = new THREE.GridHelper(1600, 80, 0x1f2850, 0x0a1028);
    gridHelper.position.set(0, -0.1, -800);
    this.scene.add(gridHelper);
  }

  // ======================== CAR MODEL ========================
  setupCar() {
    this.carGroup = new THREE.Group();

    // Color palette based on seed
    const hues = [0xff1144, 0x00d4ff, 0xffcc00, 0xaa00ff, 0x00ff88, 0xff6600];
    const carColor = hues[Math.floor(this.pseudoRandom() * hues.length)];

    // 1. Lower Chassis
    const chassisGeo = new THREE.BoxGeometry(2.4, 0.6, 5.0);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: carColor,
      metalness: 0.85,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.5;
    chassis.castShadow = true;
    this.carGroup.add(chassis);

    // 2. Cabin / Cockpit
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.55, 2.4);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x050a15,
      metalness: 0.95,
      roughness: 0.05,
      transparent: true,
      opacity: 0.85
    });
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;
    this.carGroup.add(cabin);

    // 3. Roof Scoop
    const scoopGeo = new THREE.BoxGeometry(0.7, 0.2, 1.0);
    const scoopMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
    const scoop = new THREE.Mesh(scoopGeo, scoopMat);
    scoop.position.set(0, 1.4, -0.2);
    this.carGroup.add(scoop);

    // 4. Rear Spoiler
    const wingGeo = new THREE.BoxGeometry(2.6, 0.12, 0.6);
    const wing = new THREE.Mesh(wingGeo, chassisMat);
    wing.position.set(0, 1.3, 2.1);
    this.carGroup.add(wing);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const pillar1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.2), pillarMat);
    pillar1.position.set(-0.9, 1.05, 2.1);
    this.carGroup.add(pillar1);
    const pillar2 = pillar1.clone();
    pillar2.position.x = 0.9;
    this.carGroup.add(pillar2);

    // 5. LED Headlights & Taillights
    const lightGeo = new THREE.BoxGeometry(0.45, 0.15, 0.1);
    const headMat = new THREE.MeshBasicMaterial({ color: 0x88ffff });
    const leftHead = new THREE.Mesh(lightGeo, headMat);
    leftHead.position.set(-0.85, 0.55, -2.51);
    this.carGroup.add(leftHead);
    const rightHead = leftHead.clone();
    rightHead.position.x = 0.85;
    this.carGroup.add(rightHead);

    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.1), tailMat);
    tailBar.position.set(0, 0.6, 2.51);
    this.carGroup.add(tailBar);

    // Headlight Spotlights
    const leftSpot = new THREE.SpotLight(0xccffff, 3.0, 45, Math.PI / 6, 0.4);
    leftSpot.position.set(-0.85, 0.6, -2.6);
    leftSpot.target.position.set(-0.85, 0, -35);
    this.carGroup.add(leftSpot);
    this.carGroup.add(leftSpot.target);

    const rightSpot = leftSpot.clone();
    rightSpot.position.x = 0.85;
    rightSpot.target.position.x = 0.85;
    this.carGroup.add(rightSpot);
    this.carGroup.add(rightSpot.target);

    // Underglow Neon
    const underLight = new THREE.PointLight(carColor, 3.5, 12);
    underLight.position.set(0, 0.2, 0);
    this.carGroup.add(underLight);

    // 6. Wheels (4x)
    const wheelPositions = [
      { x: -1.25, y: 0.38, z: -1.5 },
      { x: 1.25, y: 0.38, z: -1.5 },
      { x: -1.25, y: 0.42, z: 1.5 },
      { x: 1.25, y: 0.42, z: 1.5 }
    ];

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.95, roughness: 0.1 });

    wheelPositions.forEach((pos, idx) => {
      const wheelGroup = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 18), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.37, 8), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      wheelGroup.position.set(pos.x, pos.y, pos.z);
      this.carGroup.add(wheelGroup);
      this.wheels.push(wheelGroup);
    });

    // Dual Nitro Exhaust Glows
    const exMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const leftEx = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8), exMat);
    leftEx.rotation.x = Math.PI / 2;
    leftEx.position.set(-0.4, 0.35, 2.5);
    this.carGroup.add(leftEx);

    const rightEx = leftEx.clone();
    rightEx.position.x = 0.4;
    this.carGroup.add(rightEx);

    this.carGroup.position.set(0, 0, 0);
    this.scene.add(this.carGroup);
  }

  // ======================== OBSTACLE GENERATOR ========================
  setupObstacles() {
    this.obstacles = [];
    this.pickups = [];

    // Track total distance is calibrated to duration
    // Car moves at avg speed 1.8 units/frame * totalFrames
    const totalTrackDistance = this.totalFrames * 1.85;
    const startZ = -60;
    const finishZ = -totalTrackDistance + 120;

    let currentZ = startZ;

    const obstacleTypes = [
      'spiked_roller',     // Rotating cylinder with spikes
      'slam_crusher',      // Hydraulic crushing block
      'swinging_wrecking', // Pendulum steel wrecking ball
      'jump_ramp',         // Launch ramp over pit
      'traffic_truck',     // Moving obstacle truck
      'laser_barrier',     // Blinking laser grid
      'nitro_boost',       // Speed boost chevron
      'diamond_arc'        // Floating diamond score streak
    ];

    while (currentZ > finishZ + 80) {
      // Pick random obstacle type
      const type = obstacleTypes[Math.floor(this.pseudoRandom() * obstacleTypes.length)];
      const spacing = 35 + this.pseudoRandom() * 40;
      currentZ -= spacing;

      this.createObstacle(type, currentZ);
    }

    // Build Epic Finale: Mega Jump Ramp + Multiplier Rings + Finish Line
    this.createFinale(finishZ);
  }

  createObstacle(type, z) {
    const laneIdx = Math.floor(this.pseudoRandom() * this.numLanes);
    const laneX = this.lanes[laneIdx];

    switch (type) {
      case 'spiked_roller': {
        // Spans 2 lanes, rotates rapidly
        const rollerGroup = new THREE.Group();
        const rollerGeo = new THREE.CylinderGeometry(1.2, 1.2, 12, 16);
        const rollerMat = new THREE.MeshStandardMaterial({
          color: 0xff3300,
          roughness: 0.4,
          metalness: 0.8
        });
        const roller = new THREE.Mesh(rollerGeo, rollerMat);
        roller.rotation.z = Math.PI / 2;
        roller.position.y = 1.6;
        rollerGroup.add(roller);

        // Spikes
        for (let a = 0; a < 8; a++) {
          const spikeAngle = (a / 8) * Math.PI * 2;
          for (let sx = -4; sx <= 4; sx += 2) {
            const spike = new THREE.Mesh(
              new THREE.ConeGeometry(0.3, 1.0, 6),
              new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 })
            );
            spike.position.set(sx, 1.6 + Math.cos(spikeAngle) * 1.4, Math.sin(spikeAngle) * 1.4);
            spike.rotation.x = spikeAngle;
            rollerGroup.add(spike);
          }
        }

        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.8 });
        const postL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4, 0.8), pillarMat);
        postL.position.set(-6.2, 2, 0);
        rollerGroup.add(postL);
        const postR = postL.clone();
        postR.position.x = 6.2;
        rollerGroup.add(postR);

        rollerGroup.position.set(this.pseudoRandom() > 0.5 ? 5 : -5, 0, z);
        this.scene.add(rollerGroup);
        this.obstacles.push({
          type: 'spiked_roller',
          group: rollerGroup,
          z: z,
          minX: rollerGroup.position.x - 6,
          maxX: rollerGroup.position.x + 6,
          rotationSpeed: 0.08 + this.pseudoRandom() * 0.05,
          passed: false
        });
        break;
      }

      case 'slam_crusher': {
        // Heavy hydraulic block slamming down
        const crusherGroup = new THREE.Group();
        const blockGeo = new THREE.BoxGeometry(6.5, 3.5, 4.0);
        const blockMat = new THREE.MeshStandardMaterial({
          color: 0xcc9900,
          roughness: 0.5,
          metalness: 0.7
        });
        const block = new THREE.Mesh(blockGeo, blockMat);
        block.position.y = 5.0;
        crusherGroup.add(block);

        // Warning decal on road
        const warnGeo = new THREE.PlaneGeometry(6.5, 4.0);
        const warnMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.4 });
        const warn = new THREE.Mesh(warnGeo, warnMat);
        warn.rotation.x = -Math.PI / 2;
        warn.position.y = 0.04;
        crusherGroup.add(warn);

        crusherGroup.position.set(laneX, 0, z);
        this.scene.add(crusherGroup);

        this.obstacles.push({
          type: 'slam_crusher',
          group: crusherGroup,
          block: block,
          z: z,
          laneX: laneX,
          minX: laneX - 3.2,
          maxX: laneX + 3.2,
          phase: this.pseudoRandom() * Math.PI * 2,
          passed: false
        });
        break;
      }

      case 'swinging_wrecking': {
        // Swinging pendulum wrecking ball
        const gantryGroup = new THREE.Group();
        const topBar = new THREE.Mesh(
          new THREE.BoxGeometry(26, 1.0, 1.0),
          new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.8 })
        );
        topBar.position.y = 12;
        gantryGroup.add(topBar);

        // Chain + Ball
        const chainGroup = new THREE.Group();
        chainGroup.position.set(0, 12, 0);

        const ballMesh = new THREE.Mesh(
          new THREE.SphereGeometry(1.6, 20, 20),
          new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.95, roughness: 0.15 })
        );
        ballMesh.position.y = -9.5;
        chainGroup.add(ballMesh);

        const rodMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 9.5, 8),
          new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9 })
        );
        rodMesh.position.y = -4.75;
        chainGroup.add(rodMesh);

        gantryGroup.add(chainGroup);
        gantryGroup.position.set(0, 0, z);
        this.scene.add(gantryGroup);

        this.obstacles.push({
          type: 'swinging_wrecking',
          group: gantryGroup,
          chain: chainGroup,
          z: z,
          amplitude: 1.1 + this.pseudoRandom() * 0.3,
          frequency: 0.035 + this.pseudoRandom() * 0.015,
          phase: this.pseudoRandom() * Math.PI * 2,
          passed: false
        });
        break;
      }

      case 'jump_ramp': {
        // Stunt Launch Ramp
        const rampGroup = new THREE.Group();
        const rampGeo = new THREE.BoxGeometry(this.laneWidth * 1.6, 1.8, 6.0);
        const rampMat = new THREE.MeshStandardMaterial({
          color: 0x00ffcc,
          metalness: 0.8,
          roughness: 0.2
        });
        const ramp = new THREE.Mesh(rampGeo, rampMat);
        ramp.rotation.x = 0.28; // Incline
        ramp.position.y = 0.8;
        rampGroup.add(ramp);

        // Arrow neon decal
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(1.2, 2.5, 3),
          new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        arrow.rotation.x = -Math.PI / 2 + 0.28;
        arrow.position.set(0, 1.2, 0);
        rampGroup.add(arrow);

        rampGroup.position.set(laneX, 0, z);
        this.scene.add(rampGroup);

        this.obstacles.push({
          type: 'jump_ramp',
          group: rampGroup,
          z: z,
          laneX: laneX,
          minX: laneX - this.laneWidth * 0.8,
          maxX: laneX + this.laneWidth * 0.8,
          passed: false
        });
        break;
      }

      case 'traffic_truck': {
        // Moving obstacle vehicle
        const truckGroup = new THREE.Group();
        const cabGeo = new THREE.BoxGeometry(2.4, 2.0, 3.2);
        const cabMat = new THREE.MeshStandardMaterial({ color: 0x0055ff, metalness: 0.6, roughness: 0.4 });
        const cab = new THREE.Mesh(cabGeo, cabMat);
        cab.position.set(0, 1.2, -1.8);
        truckGroup.add(cab);

        const trailerGeo = new THREE.BoxGeometry(2.6, 3.2, 6.5);
        const trailerMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.4, roughness: 0.6 });
        const trailer = new THREE.Mesh(trailerGeo, trailerMat);
        trailer.position.set(0, 1.8, 2.5);
        truckGroup.add(trailer);

        // Hazard lights
        const hazMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
        const hazL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.1), hazMat);
        hazL.position.set(-1.0, 2.5, 5.8);
        truckGroup.add(hazL);
        const hazR = hazL.clone();
        hazR.position.x = 1.0;
        truckGroup.add(hazR);

        truckGroup.position.set(laneX, 0, z);
        this.scene.add(truckGroup);

        this.obstacles.push({
          type: 'traffic_truck',
          group: truckGroup,
          z: z,
          laneX: laneX,
          speedZ: 0.35 + this.pseudoRandom() * 0.3, // Moves forward slower than player
          minX: laneX - 1.4,
          maxX: laneX + 1.4,
          passed: false
        });
        break;
      }

      case 'laser_barrier': {
        // Laser energy gate
        const gateGroup = new THREE.Group();
        const postMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9 });
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 5, 12), postMat);
        p1.position.set(laneX - 3.2, 2.5, 0);
        gateGroup.add(p1);

        const p2 = p1.clone();
        p2.position.x = laneX + 3.2;
        gateGroup.add(p2);

        // Laser beam
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6.4, 8), beamMat);
        beam.rotation.z = Math.PI / 2;
        beam.position.set(laneX, 1.8, 0);
        gateGroup.add(beam);

        gateGroup.position.set(0, 0, z);
        this.scene.add(gateGroup);

        this.obstacles.push({
          type: 'laser_barrier',
          group: gateGroup,
          beam: beam,
          beamMat: beamMat,
          z: z,
          laneX: laneX,
          minX: laneX - 3.2,
          maxX: laneX + 3.2,
          blinkSpeed: 0.05 + this.pseudoRandom() * 0.03,
          phase: this.pseudoRandom() * Math.PI * 2,
          active: true,
          passed: false
        });
        break;
      }

      case 'nitro_boost': {
        // Ground speed pad
        const nitroGroup = new THREE.Group();
        const padMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 });
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.0), padMat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.y = 0.04;
        nitroGroup.add(pad);

        // Chevron arrow
        const chev = new THREE.Mesh(
          new THREE.ConeGeometry(1.2, 3.0, 3),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        chev.rotation.x = -Math.PI / 2;
        chev.position.set(0, 0.06, 0);
        nitroGroup.add(chev);

        nitroGroup.position.set(laneX, 0, z);
        this.scene.add(nitroGroup);

        this.pickups.push({
          type: 'nitro_boost',
          group: nitroGroup,
          z: z,
          laneX: laneX,
          collected: false
        });
        break;
      }

      case 'diamond_arc': {
        // Arc of floating collectable diamonds
        const diamondGroup = new THREE.Group();
        const dMat = new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: 0x0066aa,
          roughness: 0.1,
          metalness: 0.95
        });

        for (let d = 0; d < 4; d++) {
          const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), dMat);
          diamond.position.set(laneX, 1.2 + Math.sin((d / 3) * Math.PI) * 1.5, -d * 4);
          diamondGroup.add(diamond);
        }

        diamondGroup.position.set(0, 0, z);
        this.scene.add(diamondGroup);

        this.pickups.push({
          type: 'diamond_arc',
          group: diamondGroup,
          z: z,
          laneX: laneX,
          collected: false
        });
        break;
      }
    }
  }

  // ======================== FINALE ========================
  createFinale(finishZ) {
    // 1. Mega Launch Ramp
    const rampGroup = new THREE.Group();
    const rampGeo = new THREE.BoxGeometry(26, 4.5, 14);
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xff0066,
      metalness: 0.9,
      roughness: 0.15
    });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.rotation.x = 0.32;
    ramp.position.set(0, 2.0, finishZ);
    this.scene.add(ramp);
    this.megaRampMesh = ramp;

    // 2. Giant Floating Multiplier Rings
    const ringGeo = new THREE.TorusGeometry(8, 0.8, 16, 32);
    const ringColors = [0x00f0ff, 0xffcc00, 0xff0066];
    const multipliers = ['10X', '50X', '100X'];

    for (let r = 0; r < 3; r++) {
      const ringMat = new THREE.MeshBasicMaterial({ color: ringColors[r] });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 10 + r * 3, finishZ - 45 - r * 35);
      this.scene.add(ring);
    }

    // 3. Chequered Finish Arch
    const archMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const arch = new THREE.Mesh(new THREE.BoxGeometry(32, 14, 2), archMat);
    arch.position.set(0, 7, finishZ - 160);
    this.scene.add(arch);

    this.finishLineMesh = arch;
    this.finishZ = finishZ;
  }

  // ======================== AUTONOMOUS AI DRIVER ========================
  updateAIDriver() {
    if (this.isFinished) {
      // In finale air stunt: spin car for dramatic effect
      this.carRoll += 0.04;
      this.carPitch = 0.15;
      return;
    }

    const currentZ = this.carGroup.position.z;
    const lookaheadDist = 75;

    // Look for upcoming obstacles within lookahead window
    const upcomingObstacles = this.obstacles.filter(
      obs => !obs.passed && obs.z < currentZ && obs.z > currentZ - lookaheadDist
    );

    // Look for upcoming nitro and pickups
    const upcomingPickups = this.pickups.filter(
      p => !p.collected && p.z < currentZ && p.z > currentZ - lookaheadDist
    );

    // Evaluate danger for each lane (-10, -5, 0, 5, 10)
    const laneScores = [0, 0, 0, 0, 0];

    upcomingObstacles.forEach(obs => {
      const distZ = Math.abs(obs.z - currentZ);
      const urgency = (1 - distZ / lookaheadDist) * 10;

      for (let i = 0; i < this.lanes.length; i++) {
        const lx = this.lanes[i];
        if (obs.type === 'spiked_roller') {
          if (lx >= obs.minX - 1.5 && lx <= obs.maxX + 1.5) {
            laneScores[i] -= urgency * 15;
          }
        } else if (obs.type === 'slam_crusher') {
          // Dangerous if block is currently low
          if (obs.block.position.y < 2.5 && Math.abs(lx - obs.laneX) < 3.5) {
            laneScores[i] -= urgency * 18;
          }
        } else if (obs.type === 'swinging_wrecking') {
          // Danger zone around swinging ball X
          const ballX = Math.sin(obs.phase) * (obs.amplitude * 7.5);
          if (Math.abs(lx - ballX) < 3.2) {
            laneScores[i] -= urgency * 20;
          }
        } else if (obs.type === 'traffic_truck') {
          if (Math.abs(lx - obs.group.position.x) < 2.8) {
            laneScores[i] -= urgency * 12;
          }
        } else if (obs.type === 'laser_barrier') {
          if (obs.active && Math.abs(lx - obs.laneX) < 3.0) {
            laneScores[i] -= urgency * 16;
          }
        } else if (obs.type === 'jump_ramp') {
          // Jumps are fun and rewarded!
          if (Math.abs(lx - obs.laneX) < 2.5) {
            laneScores[i] += 8;
          }
        }
      }
    });

    // Reward lanes with nitro and diamonds
    upcomingPickups.forEach(p => {
      for (let i = 0; i < this.lanes.length; i++) {
        if (Math.abs(this.lanes[i] - p.laneX) < 2.0) {
          laneScores[i] += p.type === 'nitro_boost' ? 12 : 7;
        }
      }
    });

    // Slight preference for center and staying in current lane to avoid erratic jitter
    laneScores[this.currentLane] += 1.5;
    laneScores[2] += 0.5;

    // Pick best lane
    let bestLane = this.currentLane;
    let maxScore = -Infinity;
    for (let i = 0; i < laneScores.length; i++) {
      if (laneScores[i] > maxScore) {
        maxScore = laneScores[i];
        bestLane = i;
      }
    }

    this.currentLane = bestLane;
    this.carTargetX = this.lanes[this.currentLane];

    // Check for NEAR MISS event: if car is passing an obstacle within 1.8 units
    upcomingObstacles.forEach(obs => {
      const distZ = Math.abs(obs.z - currentZ);
      if (distZ < 4.0 && !obs.nearMissLogged) {
        obs.nearMissLogged = true;
        this.triggerNearMiss(obs.type);
      }
    });
  }

  triggerNearMiss(type) {
    this.combo++;
    this.score += 500 * this.combo;
    this.addBadge('⚡ CLOSE CALL!', `+${500 * this.combo} PTS`, '#00ffcc');
    this.logSound('near_miss', 8, this.carGroup.position.x);
    this.logSound('drift', 4, this.carGroup.position.x);
  }

  triggerNitro() {
    this.isNitro = true;
    this.nitroTimer = 80;
    this.currentSpeed = this.maxSpeed;
    this.combo += 2;
    this.score += 1500;
    this.addBadge('🔥 NITRO BOOST!', '320 KM/H', '#ff0066');
    this.logSound('nitro', 12, this.carGroup.position.x);
  }

  triggerJump() {
    this.isAirborne = true;
    this.verticalVel = 1.1;
    this.score += 2000;
    this.addBadge('🚀 AIRTIME STUNT!', '+2,000 PTS', '#ffcc00');
    this.logSound('jump', 10, this.carGroup.position.x);
  }

  triggerCoin(x) {
    this.score += 250 * this.combo;
    const notes = [6, 8, 10, 12, 14];
    const pitch = notes[Math.floor(this.timer / 4) % notes.length];
    this.logSound('coin', pitch, x);
  }

  addBadge(text, sub, color) {
    this.activeBadges.push({
      text: text,
      sub: sub,
      color: color,
      life: 45,
      maxLife: 45
    });
  }

  logSound(type, pitch, x) {
    this.soundEvents.push({
      frame: this.timer,
      type: type,
      pitch: pitch,
      x: typeof x === 'number' ? (x + 16) * (1080 / 32) : 540
    });
  }

  // ======================== UPDATE LOOP ========================
  update() {
    this.timer++;

    // Check if reached finale
    if (this.carGroup.position.z <= this.finishZ) {
      if (!this.isFinished) {
        this.isFinished = true;
        this.addBadge('🏆 MEGA STUNT LANDING!', '100x MULTIPLIER!', '#ffd700');
        this.logSound('win', 16, 540);
      }
    }

    // AI Autopilot Decision
    this.updateAIDriver();

    // Speed physics
    if (this.nitroTimer > 0) {
      this.nitroTimer--;
      if (this.nitroTimer === 0) this.isNitro = false;
    }

    const targetSpd = this.isNitro ? this.maxSpeed : 1.85;
    this.currentSpeed += (targetSpd - this.currentSpeed) * 0.08;

    // Move car forward
    this.carGroup.position.z -= this.currentSpeed;
    this.distance += this.currentSpeed;

    // Steering lerp (Smooth spring dampening)
    const dx = this.carTargetX - this.carGroup.position.x;
    this.steeringVel = dx * 0.12;
    this.carGroup.position.x += this.steeringVel;

    // Car Body Lean & Roll on turn
    this.carRoll = -this.steeringVel * 0.45;
    this.carYaw = -this.steeringVel * 0.25;

    // Airborne physics (Jumps / Ramps)
    if (this.isAirborne) {
      this.carGroup.position.y += this.verticalVel;
      this.verticalVel -= 0.055; // gravity
      this.carPitch = -this.verticalVel * 0.35;

      if (this.carGroup.position.y <= 0) {
        this.carGroup.position.y = 0;
        this.isAirborne = false;
        this.carPitch = 0;
        this.logSound('land', 2, this.carGroup.position.x);
      }
    } else {
      this.carGroup.position.y = 0;
    }

    // Apply rotations
    this.carGroup.rotation.z = this.carRoll;
    this.carGroup.rotation.y = this.carYaw;
    this.carGroup.rotation.x = this.carPitch;

    // Rotate Wheels
    this.wheels.forEach(w => {
      w.rotation.x -= this.currentSpeed * 0.8;
    });

    // Animate Obstacles
    this.updateObstacles();

    // Recycle Road Segments as car moves forward
    this.roadSegments.forEach(seg => {
      if (seg.position.z > this.carGroup.position.z + 100) {
        seg.position.z -= 4 * 400;
      }
    });

    // Dynamic Camera Tracking
    const camTargetZ = this.carGroup.position.z + (this.isNitro ? 18 : 15);
    const camTargetY = 7.0 + (this.isAirborne ? this.carGroup.position.y * 0.5 : 0);
    const camTargetX = this.carGroup.position.x * 0.65;

    this.camera.position.x += (camTargetX - this.camera.position.x) * 0.1;
    this.camera.position.y += (camTargetY - this.camera.position.y) * 0.1;
    this.camera.position.z += (camTargetZ - this.camera.position.z) * 0.15;

    const lookZ = this.carGroup.position.z - 20;
    this.camera.lookAt(this.carGroup.position.x * 0.4, 2.5, lookZ);

    // FOV Punch on Nitro
    const targetFOV = this.isNitro ? 78 : 65;
    this.camera.fov += (targetFOV - this.camera.fov) * 0.1;
    this.camera.updateProjectionMatrix();

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);

    // Render 2D Cyberpunk HUD
    this.renderHUD();
  }

  updateObstacles() {
    const carX = this.carGroup.position.x;
    const carZ = this.carGroup.position.z;

    this.obstacles.forEach(obs => {
      // 1. Spiked Roller Rotation
      if (obs.type === 'spiked_roller') {
        obs.group.children[0].rotation.x += obs.rotationSpeed;
      }

      // 2. Hydraulic Slam Crusher Animation
      if (obs.type === 'slam_crusher') {
        obs.phase += 0.08;
        // Fast slam down, slow rise
        const cycle = Math.sin(obs.phase);
        obs.block.position.y = cycle > 0.4 ? 1.0 : 4.5;
        if (cycle > 0.38 && cycle < 0.42 && Math.abs(carZ - obs.z) < 40) {
          this.logSound('crusher', 2, obs.laneX);
        }
      }

      // 3. Swinging Wrecking Ball
      if (obs.type === 'swinging_wrecking') {
        obs.phase += obs.frequency;
        obs.chain.rotation.z = Math.sin(obs.phase) * obs.amplitude;
      }

      // 4. Moving Traffic Truck
      if (obs.type === 'traffic_truck') {
        obs.group.position.z -= obs.speedZ;
        obs.z = obs.group.position.z;
      }

      // 5. Laser Barrier Blinking
      if (obs.type === 'laser_barrier') {
        obs.phase += obs.blinkSpeed;
        obs.active = Math.sin(obs.phase) > -0.2;
        obs.beamMat.color.setHex(obs.active ? 0xff0044 : 0x00ff88);
      }

      // 6. Ramp Collision Trigger
      if (obs.type === 'jump_ramp' && !obs.passed) {
        if (Math.abs(carZ - obs.z) < 3.5 && Math.abs(carX - obs.laneX) < 2.5) {
          obs.passed = true;
          this.triggerJump();
        }
      }

      // Flag passed
      if (obs.z > carZ + 8) {
        obs.passed = true;
      }
    });

    // Check Pickups
    this.pickups.forEach(p => {
      if (!p.collected && Math.abs(carZ - p.z) < 3.5 && Math.abs(carX - p.laneX) < 2.5) {
        p.collected = true;
        p.group.visible = false;

        if (p.type === 'nitro_boost') {
          this.triggerNitro();
        } else if (p.type === 'diamond_arc') {
          this.triggerCoin(p.laneX);
        }
      }
    });
  }

  // ======================== 2D CYBERPUNK HUD ========================
  setupHUD() {
    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = this.width;
    this.hudCanvas.height = this.height;
    this.hudCanvas.id = 'hud-canvas';
    this.hudCanvas.style.position = 'absolute';
    this.hudCanvas.style.top = '0';
    this.hudCanvas.style.left = '0';
    this.hudCanvas.style.width = '100%';
    this.hudCanvas.style.height = '100%';
    this.hudCanvas.style.pointerEvents = 'none';
    this.container.appendChild(this.hudCanvas);

    this.hudCtx = this.hudCanvas.getContext('2d');
  }

  renderHUD() {
    const ctx = this.hudCtx;
    const W = this.width;
    const H = this.height;

    ctx.clearRect(0, 0, W, H);

    // 1. Top Progress Bar (Distance to Finish Line)
    const progress = Math.min(1.0, Math.max(0, -this.carGroup.position.z / (-this.finishZ)));
    const barW = W * 0.75;
    const barX = (W - barW) / 2;
    const barY = 70;

    // Track background
    ctx.fillStyle = 'rgba(10, 14, 30, 0.75)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, barX, barY, barW, 20, 10, true, true);

    // Fill gradient
    const grad = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
    grad.addColorStop(0, '#00f0ff');
    grad.addColorStop(1, '#ff0077');
    ctx.fillStyle = grad;
    this.roundRect(ctx, barX, barY, barW * progress, 20, 10, true, false);

    // Car icon on progress bar
    const carIconX = barX + barW * progress;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(carIconX, barY + 10, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff0066';
    ctx.beginPath();
    ctx.arc(carIconX, barY + 10, 7, 0, Math.PI * 2);
    ctx.fill();

    // Finish Flag Icon
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('🏁', barX + barW + 10, barY + 18);

    // 2. Score & Multiplier (Top Left)
    ctx.fillStyle = 'rgba(10, 14, 30, 0.7)';
    this.roundRect(ctx, 40, 120, 320, 80, 12, true, false);

    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#88aaff';
    ctx.fillText('SCORE', 60, 148);

    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.score.toLocaleString(), 60, 185);

    // Combo badge
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillStyle = this.combo > 1 ? '#ffcc00' : '#888888';
    ctx.fillText(`x${this.combo} MULTIPLIER`, 230, 150);

    // 3. Speedometer Dial (Bottom Center)
    const speedKmh = Math.round((this.currentSpeed / 1.85) * 220);
    const speedX = W / 2;
    const speedY = H - 240;

    // Dial background glow
    const dialGrad = ctx.createRadialGradient(speedX, speedY, 40, speedX, speedY, 140);
    dialGrad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
    dialGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = dialGrad;
    ctx.beginPath();
    ctx.arc(speedX, speedY, 140, 0, Math.PI * 2);
    ctx.fill();

    // Speed Digital Display
    ctx.textAlign = 'center';
    ctx.font = '900 84px "Segoe UI", sans-serif';
    ctx.fillStyle = this.isNitro ? '#ff0077' : '#00f0ff';
    ctx.fillText(speedKmh, speedX, speedY + 25);

    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.fillStyle = '#88aacc';
    ctx.fillText('KM/H', speedX, speedY + 65);

    // Nitro gauge bar below speedometer
    const nitroW = 280;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.roundRect(ctx, speedX - nitroW / 2, speedY + 90, nitroW, 12, 6, true, false);

    const nitroFill = this.nitroTimer / 80;
    if (nitroFill > 0) {
      ctx.fillStyle = '#ff0077';
      this.roundRect(ctx, speedX - nitroW / 2, speedY + 90, nitroW * nitroFill, 12, 6, true, false);
    }

    // 4. Active Badges (Floating stunt popups)
    for (let b = this.activeBadges.length - 1; b >= 0; b--) {
      const badge = this.activeBadges[b];
      badge.life--;
      if (badge.life <= 0) {
        this.activeBadges.splice(b, 1);
        continue;
      }

      const alpha = Math.min(1.0, badge.life / 15);
      const yOffset = (1 - badge.life / badge.maxLife) * 80;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';

      // Badge container
      ctx.fillStyle = 'rgba(10, 15, 35, 0.85)';
      ctx.strokeStyle = badge.color;
      ctx.lineWidth = 3;
      this.roundRect(ctx, W / 2 - 220, H * 0.42 - yOffset, 440, 95, 18, true, true);

      // Title
      ctx.font = '900 36px "Segoe UI", sans-serif';
      ctx.fillStyle = badge.color;
      ctx.fillText(badge.text, W / 2, H * 0.42 - yOffset + 45);

      // Subtitle
      ctx.font = 'bold 24px "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(badge.sub, W / 2, H * 0.42 - yOffset + 80);

      ctx.restore();
    }

    // 5. Grand Finale Overlay
    if (this.isFinished) {
      this.finishTimer++;
      const alpha = Math.min(0.92, this.finishTimer / 60);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(5, 8, 20, 0.85)';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.font = '900 68px "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('🏆 VICTORY!', W / 2, H * 0.38);

      ctx.font = 'bold 36px "Segoe UI", sans-serif';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('STUNT MULTIPLIER: 100X', W / 2, H * 0.46);

      ctx.font = '900 76px "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`TOTAL: ${(this.score * 100).toLocaleString()}`, W / 2, H * 0.55);

      ctx.font = 'bold 28px "Segoe UI", sans-serif';
      ctx.fillStyle = '#ff0077';
      ctx.fillText('🔥 MAXIMUM OVERDRIVE COMPLETE 🔥', W / 2, H * 0.63);

      ctx.restore();
    }

    ctx.textAlign = 'left'; // reset
  }

  roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (width <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
}

// Expose globally for browser and headless Puppeteer
if (typeof window !== 'undefined') {
  window.CarObstacleGame = CarObstacleGame;
}
