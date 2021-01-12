var matcherFactory = require('./arrow-function-expression');

describe('ArrowFunctionExpression matcher', () => {

  var matcher;

  beforeEach(() => {
    matcher = matcherFactory();
  });

  it("should return null for any argument", () => {
    expect(matcher()).toBeNull();
    expect(matcher(null)).toBeNull();
    expect(matcher({})).toBeNull();
  });
});