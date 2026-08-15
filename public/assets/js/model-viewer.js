(function initialiseModelViewer() {
    const container = document.querySelector("[data-model-url]");

    if (!container) {
        return;
    }

    const status = container.querySelector(".model-status");
    const modelUrl = container.dataset.modelUrl.trim();

    const showError = (message) => {
        container.classList.add("model-viewer--error");
        status.hidden = false;
        status.textContent = message;
    };

    if (!modelUrl) {
        showError(
            container.dataset.unavailableMessage ||
                "This 3D model was not included in the original prototype files.",
        );
        return;
    }

    if (!window.THREE || !THREE.GLTFLoader || !THREE.OrbitControls) {
        showError("The 3D viewer could not start. Please refresh and try again.");
        return;
    }

    let renderer;

    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
        console.error(error);
        showError("WebGL is unavailable in this browser or device.");
        return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.domElement.setAttribute("aria-label", "Interactive 3D plant model");
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffdd, 0x152015, 1.35));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9fd8ff, 0.55);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    controls.enableDamping = false;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI;

    const render = () => renderer.render(scene, camera);

    const resize = () => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);

        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        render();
    };

    const fitCameraToModel = (model) => {
        const bounds = new THREE.Box3().setFromObject(model);

        if (bounds.isEmpty()) {
            throw new Error("The model has no visible geometry.");
        }

        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        const fieldOfView = THREE.MathUtils.degToRad(camera.fov);
        const distance = (maxDimension / (2 * Math.tan(fieldOfView / 2))) * 1.55;

        model.position.sub(center);
        camera.position.set(distance * 0.3, distance * 0.18, distance);
        camera.near = Math.max(distance / 100, 0.01);
        camera.far = Math.max(distance * 100, 100);
        camera.updateProjectionMatrix();

        controls.target.set(0, 0, 0);
        controls.minDistance = distance * 0.35;
        controls.maxDistance = distance * 4;
        controls.update();
    };

    controls.addEventListener("change", render);
    renderer.domElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        showError("The 3D viewer lost its graphics context. Refresh to reload it.");
    });

    resize();

    if ("ResizeObserver" in window) {
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
    } else {
        window.addEventListener("resize", resize);
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
        modelUrl,
        (gltf) => {
            try {
                scene.add(gltf.scene);
                fitCameraToModel(gltf.scene);
                status.hidden = true;
                container.classList.add("model-viewer--ready");
                render();
            } catch (error) {
                console.error(error);
                showError("This 3D model could not be displayed.");
            }
        },
        (event) => {
            if (event.lengthComputable && event.total > 0) {
                const progress = Math.round((event.loaded / event.total) * 100);
                status.textContent = `Loading interactive 3D model… ${progress}%`;
            }
        },
        (error) => {
            console.error(`Unable to load ${modelUrl}`, error);
            showError("This 3D model could not be loaded. Please try again later.");
        },
    );
})();
