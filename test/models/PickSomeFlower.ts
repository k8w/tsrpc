export default class PickSomeFlower {
    static makeFlower(content: object): string {
        return PickSomeFlower.encFlower(JSON.stringify(content))
    }

    static parseFlower(content: string): object {
        return JSON.parse(PickSomeFlower.decFlower(content))
    }

    //加密 倒序取反
    static encFlower(src: string): string {
        return escape(src).split('').map(v=>String.fromCharCode(v.charCodeAt(0)*-1)).reverse().join('')
    }

    static decFlower(src: string): string {
        return unescape(src.split('').map(v=>String.fromCharCode(v.charCodeAt(0)*-1)).reverse().join(''))
    }
}