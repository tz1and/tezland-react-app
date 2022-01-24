import { AssertionError } from 'assert';
import 'jest';
import Grid2D from './Grid2D';

test('contruction', () => {
    const gridNumber: Grid2D<number> = new Grid2D([10, 10]);

    expect(gridNumber.size === [10, 10]);
    expect(gridNumber.grid.length === 10);
    expect(gridNumber.grid[0].length === 10);
    
    expect(gridNumber.grid[0][0] === undefined);
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

    expect(() => gridNumber.set([5, 5], 10))
    expect(gridNumber.get([5, 5]) === 10);

    expect(() => gridNumber.set([5, 5], 20))
    expect(gridNumber.get([5, 5]) === 20);
});