import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const publicDirectory = path.join(projectDirectory, "public");
const maximumGitFileSize = 100 * 1024 * 1024;
const errors = [];
const modelViewerScripts = [
    "./assets/vendor/three/three.min.js",
    "./assets/vendor/three/GLTFLoader.js",
    "./assets/vendor/three/OrbitControls.js",
    "./assets/js/model-viewer.js",
];

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(entryPath) : [entryPath];
    });
}

function isExternalReference(reference) {
    return (
        !reference ||
        reference.startsWith("#") ||
        reference.startsWith("//") ||
        /^[a-z][a-z\d+.-]*:/i.test(reference)
    );
}

function hasExactCase(targetPath) {
    const relativePath = path.relative(publicDirectory, targetPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        return false;
    }

    let currentPath = publicDirectory;

    for (const segment of relativePath.split(path.sep).filter(Boolean)) {
        if (!fs.existsSync(currentPath)) {
            return false;
        }

        const entries = fs.readdirSync(currentPath);
        if (!entries.includes(segment)) {
            return false;
        }

        currentPath = path.join(currentPath, segment);
    }

    return fs.existsSync(currentPath);
}

function validateReference(sourcePath, rawReference) {
    const reference = rawReference.trim();

    if (isExternalReference(reference)) {
        return;
    }

    const sourceLabel = path.relative(projectDirectory, sourcePath);

    if (reference.includes("\\")) {
        errors.push(`${sourceLabel}: URL uses a Windows backslash: ${reference}`);
        return;
    }

    if (reference.startsWith("/")) {
        errors.push(`${sourceLabel}: root-relative URL breaks project Pages sites: ${reference}`);
        return;
    }

    let decodedReference;
    try {
        decodedReference = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    } catch {
        errors.push(`${sourceLabel}: URL cannot be decoded: ${reference}`);
        return;
    }

    const targetPath = path.resolve(path.dirname(sourcePath), decodedReference);

    if (!hasExactCase(targetPath)) {
        errors.push(`${sourceLabel}: missing or case-mismatched asset: ${reference}`);
    }
}

if (!fs.existsSync(publicDirectory)) {
    console.error("Site check failed: public/ does not exist.");
    process.exit(1);
}

const files = walk(publicDirectory);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const cssFiles = files.filter((file) => file.endsWith(".css"));
const gltfFiles = files.filter((file) => file.endsWith(".gltf"));

for (const requiredFile of ["index.html", ".nojekyll"]) {
    const requiredPath = path.join(publicDirectory, requiredFile);
    if (!fs.existsSync(requiredPath)) {
        errors.push(`public/${requiredFile} is required for deployment.`);
    }
}

for (const file of files) {
    const size = fs.statSync(file).size;
    if (size >= maximumGitFileSize) {
        errors.push(
            `${path.relative(projectDirectory, file)} is ${(size / 1024 / 1024).toFixed(1)} MiB; GitHub rejects files of 100 MiB or larger.`,
        );
    }
}

for (const htmlFile of htmlFiles) {
    const html = fs.readFileSync(htmlFile, "utf8");
    const referencePattern = /(?:src|href|data-model-url)\s*=\s*["']([^"']*)["']/gi;

    for (const match of html.matchAll(referencePattern)) {
        validateReference(htmlFile, match[1]);
    }

    if (/\bdata-model-url\s*=/.test(html)) {
        let previousScriptIndex = -1;

        for (const scriptPath of modelViewerScripts) {
            const scriptIndex = html.indexOf(scriptPath);

            if (scriptIndex === -1) {
                errors.push(
                    `${path.relative(projectDirectory, htmlFile)}: missing local 3D viewer dependency: ${scriptPath}`,
                );
            } else if (scriptIndex < previousScriptIndex) {
                errors.push(
                    `${path.relative(projectDirectory, htmlFile)}: 3D viewer dependencies are in the wrong load order.`,
                );
            }

            previousScriptIndex = Math.max(previousScriptIndex, scriptIndex);
        }
    }
}

for (const cssFile of cssFiles) {
    const css = fs.readFileSync(cssFile, "utf8");
    const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;

    for (const match of css.matchAll(urlPattern)) {
        validateReference(cssFile, match[1]);
    }
}

for (const gltfFile of gltfFiles) {
    let manifest;

    try {
        manifest = JSON.parse(fs.readFileSync(gltfFile, "utf8"));
    } catch (error) {
        errors.push(`${path.relative(projectDirectory, gltfFile)}: invalid JSON (${error.message})`);
        continue;
    }

    for (const buffer of manifest.buffers || []) {
        validateReference(gltfFile, buffer.uri);

        if (!isExternalReference(buffer.uri)) {
            const bufferPath = path.resolve(path.dirname(gltfFile), buffer.uri);
            if (fs.existsSync(bufferPath) && fs.statSync(bufferPath).size < buffer.byteLength) {
                errors.push(
                    `${path.relative(projectDirectory, bufferPath)} is smaller than the byteLength declared by its glTF.`,
                );
            }
        }
    }

    for (const image of manifest.images || []) {
        if (image.uri) {
            validateReference(gltfFile, image.uri);
        }
    }
}

if (errors.length > 0) {
    console.error(`Site check failed with ${errors.length} error(s):`);
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exit(1);
}

const publicSize = files.reduce((total, file) => total + fs.statSync(file).size, 0);
console.log(
    `Site check passed: ${htmlFiles.length} HTML pages, ${gltfFiles.length} glTF packages, ` +
        `${files.length} files, ${(publicSize / 1024 / 1024).toFixed(1)} MiB.`,
);
