import { AssertionError } from 'assert';
import 'jest';
import Grid2D, { GridBenchmark, Tuple, WorldGridAccessor } from './Grid2D';

test('contruction', () => {
    const gridNumber: Grid2D<number> = new Grid2D([10, 10]);

    expect(gridNumber.getSize()).toStrictEqual([10, 10]);
    expect(gridNumber.getGrid().length).toBe(10);
    expect(gridNumber.getGrid()[0].length).toBe(10);
    
    expect(gridNumber.getGrid()[0][0]).toBe(undefined);
});

test('get/set', () => {
    const gridNumber: Grid2D<number> = new Grid2D([10, 10]);

    expect(() => gridNumber.set([10, 5], 10)).toThrow(AssertionError);
    expect(() => gridNumber.set([4, 11], 10)).toThrow(AssertionError);
    expect(() => gridNumber.set([1, -15], 10)).toThrow(AssertionError);
    expect(() => gridNumber.set([-4, 5], 10)).toThrow(AssertionError);

    expect(() => gridNumber.get([10, 5])).toThrow(AssertionError);
    expect(() => gridNumber.get([4, 11])).toThrow(AssertionError);
    expect(() => gridNumber.get([1, -15])).toThrow(AssertionError);
    expect(() => gridNumber.get([-4, 5])).toThrow(AssertionError);

    expect(() => gridNumber.set([5, 5], 10)).not.toThrow(AssertionError);
    expect(gridNumber.get([5, 5])).toBe(10);

    expect(() => gridNumber.set([5, 5], 20)).not.toThrow(AssertionError);
    expect(gridNumber.get([5, 5])).toBe(20);
});

test('WorldGridAccessor even', () => {
    //const gridNumber: Grid2D<number> = new Grid2D([10, 10]);
    const gridSize: Tuple = [4, 4];
    const worldAccessor: WorldGridAccessor = new WorldGridAccessor([1000, 1000], [500, 500]);

    expect(worldAccessor.accessor([0, 0], gridSize)).toStrictEqual([2, 2]);

    expect(worldAccessor.accessor([1, 1], gridSize)).toStrictEqual([2, 2]);
    expect(worldAccessor.accessor([-1, -1], gridSize)).toStrictEqual([1, 1]);

    expect(worldAccessor.accessor([49.999, 49.999], gridSize)).toStrictEqual([2, 2]);
    expect(worldAccessor.accessor([-49.999, -49.999], gridSize)).toStrictEqual([1, 1]);

    expect(worldAccessor.accessor([250, 250], gridSize)).toStrictEqual([3, 3]);
    expect(worldAccessor.accessor([-250, -250], gridSize)).toStrictEqual([1, 1]);

    expect(worldAccessor.accessor([300, 300], gridSize)).toStrictEqual([3, 3]);
    expect(worldAccessor.accessor([-300, -300], gridSize)).toStrictEqual([0, 0]);

    // Note: expected result, as these are out of bounds
    expect(worldAccessor.accessor([500, 500], gridSize)).toStrictEqual([4, 4]);
    expect(worldAccessor.accessor([-500.001, -500.001], gridSize)).toStrictEqual([-1, -1]);
});

test('WorldGridAccessor odd', () => {
    //const gridNumber: Grid2D<number> = new Grid2D([10, 10]);
    const gridSize: Tuple = [5, 5];
    const worldAccessor: WorldGridAccessor = new WorldGridAccessor([1000, 1000], [500, 500]);

    expect(worldAccessor.accessor([0, 0], gridSize)).toStrictEqual([2, 2]);
    expect(worldAccessor.accessor([1, 1], gridSize)).toStrictEqual([2, 2]);
    expect(worldAccessor.accessor([-1, -1], gridSize)).toStrictEqual([2, 2]);

    // Note: expected result, as these are out of bounds
    expect(worldAccessor.accessor([500, 500], gridSize)).toStrictEqual([5, 5]);
    expect(worldAccessor.accessor([-500.001, -500.001], gridSize)).toStrictEqual([-1, -1]);
});

test('get/set WorldGridAccessor', () => {
    const gridNumber: Grid2D<number> = new Grid2D([5, 5]);
    const worldAccessor: WorldGridAccessor = new WorldGridAccessor([1000, 1000], [500, 500]);

    expect(() => gridNumber.setA(worldAccessor, [0, 0], 10)).not.toThrow(AssertionError);
    expect(gridNumber.getA(worldAccessor, [1, 1])).toBe(10);
    expect(gridNumber.getA(worldAccessor, [-1, -1])).toBe(10);
    expect(gridNumber.getA(worldAccessor, [99, 99])).toBe(10);
    expect(gridNumber.getA(worldAccessor, [-99, -99])).toBe(10);

    expect(() => gridNumber.setA(worldAccessor, [499.999, 499.999], 13)).not.toThrow(AssertionError);
    expect(gridNumber.getA(worldAccessor, [499.999, 499.999])).toBe(13);
    expect(gridNumber.getA(worldAccessor, [401, 401])).toBe(13);

    expect(() => gridNumber.setA(worldAccessor, [-499.999, -499.999], 15)).not.toThrow(AssertionError);
    expect(gridNumber.getA(worldAccessor, [-499.999, -499.999])).toBe(15);
    expect(gridNumber.getA(worldAccessor, [-401, -401])).toBe(15);

    expect(() => gridNumber.setA(worldAccessor, [-499.999, -499.999], 17)).not.toThrow(AssertionError);
    expect(gridNumber.getA(worldAccessor, [-499.999, -499.999])).toBe(17);
    expect(gridNumber.getA(worldAccessor, [-401, -401])).toBe(17);
});

test('run benchmark', () => {
    const bench = new GridBenchmark(new Grid2D<number>([1, 1]));

    bench.run([10,10]);
    bench.run([100,100]);
    bench.run([1000,1000]);
    bench.run([10000,10000]);
});