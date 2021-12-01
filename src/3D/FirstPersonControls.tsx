import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'
import * as THREE from 'three';

class FirstPersonControls {

    camControls: PointerLockControls;
    controlsState = {
        moveForward: false,
        moveBackward: false,
        moveLeft: false,
        moveRight: false,
        canJump: false,
        velocity: new THREE.Vector3(),
        direction: new THREE.Vector3(),
        flying: true
    }

    constructor(camera: THREE.Camera, scene: THREE.Scene, appControlfunctions: any) {
        // TODO: https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_pointerlock.html
        // TODO quake style controls: https://github.com/WiggleWizard/quake3-movement-unity3d/blob/master/CPMPlayer.js
        this.camControls = new PointerLockControls(camera, document.body);

        const overlay_blocker = document.getElementById('app-overlay');

        if (overlay_blocker) {
            overlay_blocker.addEventListener('click', () => {
                this.camControls.lock();
            });

            this.camControls.addEventListener('lock', () => {
                appControlfunctions.setOverlayDispaly(false);
            });

            this.camControls.addEventListener('unlock', () => {
                // is there some way to distinguish between unlock from code and escape?
                appControlfunctions.setOverlayDispaly(true);
            });
        }

        scene.add(this.camControls.getObject());

        const onKeyDown = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.controlsState.moveForward = true;
                    break;

                case 'ArrowLeft':
                case 'KeyA':
                    this.controlsState.moveLeft = true;
                    break;

                case 'ArrowDown':
                case 'KeyS':
                    this.controlsState.moveBackward = true;
                    break;

                case 'ArrowRight':
                case 'KeyD':
                    this.controlsState.moveRight = true;
                    break;

                case 'Space':
                    if (this.controlsState.canJump === true) this.controlsState.velocity.y += 350;
                    this.controlsState.canJump = false;
                    break;
            }
        };

        const onKeyUp = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.controlsState.moveForward = false;
                    break;

                case 'ArrowLeft':
                case 'KeyA':
                    this.controlsState.moveLeft = false;
                    break;

                case 'ArrowDown':
                case 'KeyS':
                    this.controlsState.moveBackward = false;
                    break;

                case 'ArrowRight':
                case 'KeyD':
                    this.controlsState.moveRight = false;
                    break;

                case 'KeyM': // Opens the mint form
                    if (this.camControls.isLocked === true) {
                        this.camControls.unlock();
                        appControlfunctions.loadForm('mint');
                    }
                    break;

                case 'KeyP': // Opens the place form
                    if (this.camControls.isLocked === true) {
                        this.camControls.unlock();
                        appControlfunctions.loadForm('place');
                    }
                    break;

                case 'KeyI': // Opens the inventory
                    if (this.camControls.isLocked === true) {
                        this.camControls.unlock();
                        appControlfunctions.loadForm('inventory');
                    }
                    break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        /*const controls = new OrbitControls( camera, renderer.domElement );
        controls.addEventListener( 'change', render );
        //controls.maxPolarAngle = Math.PI / 2;
        controls.enableZoom = false;
        controls.enablePan = false;*/

        /*camControls = new FirstPersonControls(camera, renderer.domElement);
        camControls.lookSpeed = 0.4;
        camControls.movementSpeed = 0.5;
        camControls.lookVertical = true;
        camControls.constrainVertical = false;
        camControls.verticalMin = 1.0;
        camControls.verticalMax = 2.0;
        camControls.heightMax = 1.8;
        camControls.heightMin = 1.8;*/
    }

    processInput(delta_time: number) {
        if (this.camControls.isLocked === true) {
            const speed = 20;

            this.controlsState.velocity.x -= this.controlsState.velocity.x * 10.0 * delta_time;
            this.controlsState.velocity.z -= this.controlsState.velocity.z * 10.0 * delta_time;
            // TODO: implement fly controls
            //if(controlsState.flying) controlsState.velocity.y -= controlsState.velocity.y * 10.0 * delta_time;

            //controlsState.velocity.y -= 9.8 * 100.0 * delta_time; // 100.0 = mass

            this.controlsState.direction.z = Number(this.controlsState.moveForward) - Number(this.controlsState.moveBackward);
            this.controlsState.direction.x = Number(this.controlsState.moveRight) - Number(this.controlsState.moveLeft);
            this.controlsState.direction.normalize(); // this ensures consistent movements in all directions

            if (this.controlsState.moveForward || this.controlsState.moveBackward) this.controlsState.velocity.z -= this.controlsState.direction.z * speed * delta_time;
            if (this.controlsState.moveLeft || this.controlsState.moveRight) this.controlsState.velocity.x -= this.controlsState.direction.x * speed * delta_time;

            /*if (onObject === true) {
            controlsState.velocity.y = Math.max( 0, controlsState.velocity.y );
            controlsState.canJump = true;
            }*/

            this.camControls.moveRight(- this.controlsState.velocity.x * delta_time);
            this.camControls.moveForward(- this.controlsState.velocity.z * delta_time);

            this.camControls.getObject().position.y += (this.controlsState.velocity.y * delta_time); // new behavior

            /*if (camControls.getObject().position.y < 10) {
            controlsState.velocity.y = 0;
            camControls.getObject().position.y = 10;
        
            controlsState.canJump = true;
            }*/
        }
    }
};

export default FirstPersonControls;