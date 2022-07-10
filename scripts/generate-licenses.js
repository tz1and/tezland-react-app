var checker = require('license-checker-rseidelsohn');
var fs = require('fs');
var process = require('process');

// license-checker --production --excludePrivatePackages --json --out src/license.json

console.log("Looking for licenses in " + process.cwd())

checker.init({
    start: '.',
    production: true,
    excludePrivatePackages: true,
    direct: 0 // NOTE: bug in license-checker-rseidelsohn
}, function(err, packages) {
    if (err) {
        console.error(err);
        exit(1);
    } else {
        const licenses = [];

        for (const [name, package] of Object.entries(packages)) {
            const nameWithoutVersion = name.substring(0, name.lastIndexOf('@'));

            const licenseFileContents = package.licenseFile ? fs.readFileSync(package.licenseFile, 'utf-8') : '';

            licenses.push({
                name: nameWithoutVersion,
                repoLink: package.repository ? package.repository : '',
                licenses: package.licenses,
                licenseFile: licenseFileContents
            });
        }

        const outFileName = 'src/acknowledgements.json';
        console.log("Writing licenses to " + outFileName);
        fs.writeFileSync(outFileName, JSON.stringify(licenses));

        //console.dir(packages, {depth: 100});
        //console.dir(licenses, {depth: 100});
    }
});