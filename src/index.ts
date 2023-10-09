import packageJson from '../package.json'

export default class Tracker {
    readonly version: string = packageJson.version
}
