import { Flow } from '../../packages/base/src/models/Flow';

export class Test1 {
  flows?: Flows<this>;

  testAAA!: <T extends this>(call: T) => void | Promise<void>;
  // testBBB!: (call: this) => (void | Promise<void>);

  asdf!: { [K in keyof Test1]: K }[keyof Test1];
}

export abstract class Test2 extends Test1 {
  // declare flows: Flows<this>;

  // flows2!: Flows<this>;
  // flows3!: Flow2<this>;

  test123() {}

  asdf!: { [K in keyof Test2]: K }[keyof Test1];
  // asdf!: { [K in keyof Test2]: K }[keyof Test2];
}

type FFF = Test2 extends Test1 ? true : false;
let res: FFF = true;
console.log(res);

export interface Flows<Conn extends Test1> {
  // test: (e: Flow<Conn>) => void,
  test1: Flow<Conn>;
  // test2: <T extends Conn>(e: T) => T;
  // test3: ReturnType<<T extends Conn>(e?: Flow<T>) => Flow<T>>
  test4: Flow2<Conn>;
  // test5: Flow2<XXX<Conn>>,
}

interface FF<T> {
  /**
   * Append a node function to the last
   * @param node
   * @returns
   */
  push<K extends T>(node: K): K;
}

class Flow2<T> {
  nodes!: FlowNode<T>[];
  push<K extends T>(node: FlowNode<K>): FlowNode<T> {
    throw new Error();
  }
  remove<K extends T>(node: FlowNode<T>) {
    throw new Error();
  }

  onError?: <K extends T>(e: Error, last: K, input: K) => void;
}

export type FlowNodeReturn<T> = T | null | undefined;
export type FlowNode<T> = <U extends T>(
  item: U
) => FlowNodeReturn<T> | Promise<FlowNodeReturn<T>>;

export interface AAA {
  aaa: { valueAAA: string };
  bbb: { valueBBB: string };
}

export type XXX<VVV extends Test1> = {
  [K in keyof VVV]: {
    name: K;
  };
}[keyof VVV];
