export class PathUtil {
    static join(...paths: string[]) {
        return paths.map(v => v.replace(/\\/g, '/').replace(/\/$/, '')).filter(v => !!v).join('/');
    }
}