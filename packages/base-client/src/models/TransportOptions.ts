export interface TransportOptions {
    /**
     * Timeout of this request（ms）
     * `undefined` represents no timeout
     * @defaultValue `undefined`
     */
    timeout?: number;

    /**
     * Which can be passed to `client.abortByKey(abortKey)`.
     * Many requests can share the same `abortKey`, so that they can be aborted at once.
     * @remarks
     * This may be useful in frontend within React or VueJS.
     * You can specify a unified `abortKey` to requests in a component, and abort them when the component is destroying.
     * @example
     * ```ts
     * // Send API request many times
     * client.callApi('SendData', { data: 'AAA' }, { abortKey: 'Session#123' });
     * client.callApi('SendData', { data: 'BBB' }, { abortKey: 'Session#123' });
     * client.callApi('SendData', { data: 'CCC' }, { abortKey: 'Session#123' });
     * 
     * // And abort the at once
     * client.abortByKey('Session#123');
     * ```
     */
    abortKey?: string;
}