'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const stat = util.promisify(fs.stat);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const minimist = require('minimist');
const glob = util.promisify(require('glob'));
const parse = require('parse-gitignore');

let { dir: filesDir, pattern: searchPattern, ignore: ignoreFilePath } = minimist(process.argv.slice(2));
filesDir = getAbsolutePath(filesDir);

if (ignoreFilePath) {
    ignoreFilePath = getAbsolutePath(ignoreFilePath);
}

modifyFiles(filesDir, searchPattern, ignoreFilePath)
    .then(result => console.log(result))
    .catch(err => console.error(err.message));

function modifyFiles (filesDir, searchPattern, ignoreFilePath) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!filesDir || !searchPattern) {
                throw new Error('Необходимо передать путь к директории и шаблон поиска');
            }

            const stats = await stat(filesDir);
            if (!stats.isDirectory()) {
                throw new Error('Путь задан не к директории');
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                throw new Error('Несуществующий путь');
            }

            reject(err);
        }

        try {
            const ignorePattern = await readFile(ignoreFilePath, 'utf8');
            let files = await glob(searchPattern, { cwd: filesDir, dot: true, ignore: parse(ignorePattern) });

            if (!files.length) {
                reject('Шаблону не соответствует ни один файл из заданной директории');
            }

            const textToAdd = '/* script was here */\n\n';
            files = files.map(async file => {
                const filePath = path.join(filesDir, file);
                const data = await readFile(filePath, 'utf8');
                await writeFile(filePath, `${textToAdd} ${data}`);
            });

            await Promise.all(files);

            resolve('Done');
        } catch (err) {
            reject(err);
        }
    });
}

function getAbsolutePath(pathToModify) {
    return path.resolve(path.normalize(pathToModify));
}

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at:', p, 'reason:', reason);
});
