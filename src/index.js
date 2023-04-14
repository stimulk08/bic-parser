import Zip from 'adm-zip';
import fetch from 'node-fetch';
import iconLite from 'iconv-lite';
import fs from 'fs';
import { xml2js } from 'xml-js';

class BicsParser {
    bikSourceUrl;
    constructor(bikSourceUrl) {
        this.bikSourceUrl = bikSourceUrl;
    }

    fetchBicsArchive() {
        return new Promise(async (resolve, reject) => {
            const res = await fetch(this.bikSourceUrl);

            if (!res.ok)
                return reject(new Error(`Fetch failed with status code ${res.status}`));
            
            const arrayBuffer = await res.arrayBuffer();

            return resolve(Buffer.from(arrayBuffer));
        })
    }

    parseByJson(bicXml) {
        const bicJsons = xml2js(bicXml).elements[0].elements;
        return bicJsons.reduce((bics, bik) => {
            const bicInfos = bik.elements;
            if (!bicInfos) return bics;

            const accountIds = [];
            let name;

            bicInfos.forEach(info => {
                if (info.name === 'Accounts' && info.attributes.Account) {
                    accountIds.push(info.attributes.Account)
                }
                else if (info.name === 'ParticipantInfo') {
                    name = info.attributes.NameP;
                }
            });

            accountIds.forEach(corrAccount => bics.push({ 
                bik: bik.attributes.BIC,
                name,
                corrAccount 
            }));

            return bics;
        }, []);
    }

    async getBics() {
        return new Promise((resolve, reject) => {
            return this.fetchBicsArchive()
                .then(archiveBuffer => {
                    const xmlEntry = new Zip(archiveBuffer).getEntries()[0];
                    xmlEntry.getDataAsync(data => {
                        const bikXml = iconLite.decode(data, 'windows-1251');
                        return resolve(this.parseByJson(bikXml));
                });
            });
        })
    }
}

(async () => {
    const parser = new BicsParser('http://www.cbr.ru/s/newbik');
    const bics = await parser.getBics().catch(console.log);
    console.log(bics);
})();



