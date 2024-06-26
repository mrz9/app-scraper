import Log from "../utils/Log.js";
import { createDir } from "../utils/index.js";
import { saveOrUpdate } from "../data-source.js";
import { osTypeEnum, country } from "../const.js";
import fs from "fs/promises";
import { resolve } from "path";
import * as Android from './android.js'
import * as iOS from './ios.js'

export async function run(type) {

    const isAndroid = osTypeEnum.android === type;

    const DATA_PATH = resolve(`./data/${type}/${Date.now()}`);
    await createDir(DATA_PATH);

    const category = isAndroid ? Android.category : iOS.category;
    const collection = isAndroid ? Android.collection : iOS.collection

    async function saveFetchData(filename, data) {
        const file = resolve(DATA_PATH, filename);
        return fs.writeFile(file, data, "utf-8").catch(console.error);
    }

    /**
     * 采集分类app
     * @param options IFnListOptions
     */
    async function scraper(options) {
        const { collection, category, country} = options
        try {
            const scraperCall = isAndroid ? Android.scraper : iOS.scraper
            const rs = await scraperCall(options);

            if (rs && rs.length) {
                await saveFetchData(
                    `${country}-${category}-${collection}.json`,
                    JSON.stringify(rs, null, 4)
                );
                for (let i = 0, len = rs.length; i < len; i++) {
                    // 扩展国家字段，用于入库
                    rs[i].__country = country;
                    rs[i].__collection = collection;
                    rs[i].__category = category;
                    await saveOrUpdate(rs[i], type);
                }
            }
            Log.info(`${type}, collection: ${collection}, category: ${category}, country: ${country}，已采集${rs.length}条数据`);
        } catch (e) {
            Log.info(`${type}, collection: ${collection}, category: ${category}, country: ${country}，采集出错`);
            await saveFetchData(
                `error-${country}-${category}-${collection}.log`,
                e.stack ?? e.message
            );
        }

    }

    /**
     * 
     * @param {Array} tasks 
     * @returns 
     */
    async function taskPool(tasks) {
        return new Promise((resolve) => {
            const poool = [];
            const maxTask = 5;

            function addTask() {
                if (tasks.length && poool.length < maxTask) {
                    const item = tasks.pop();
                    poool.push(1);
                    console.log(`${type} 剩余任务数量${tasks.length}, 任务池${poool.length}`)
                    const islast = tasks.length === 0
                    scraper(item).finally(() => {
                        poool.pop()
                        if (islast) {
                            resolve()
                        } else {
                            addTask()
                        }
                    })
                }
            }

            for (let i = 0; i < maxTask; i++) {
                addTask();
            }
        })
    }

    console.time(type);
    const flatTask = []
    // 按国家采集
    for (let i = 0, len = country.length; i < len; i++) {
        for (let [_key, cateVal] of Object.entries(category)) {
            for (let [_colKey, colVal] of Object.entries(collection)) {
                flatTask.push({
                    collection: colVal,
                    category: cateVal,
                    country: String(country[i].value).toLocaleLowerCase(),
                })
            }
        }
    }
    await taskPool(flatTask);

    console.timeEnd(type);
    conosle.log(`${type} done`)
}

