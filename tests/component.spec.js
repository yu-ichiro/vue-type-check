const assert = require("assert");
const path = require("path");
const { exec } = require("child_process");

const bin = path.resolve(__dirname, "../dist/cli.js");
const fixtureDir = path.resolve(__dirname, "./fixture");

const spec = (err, stdout) => {
  assert.equal(Boolean(err), true);
  assert.ok(
    stdout.includes(`
3:41 Property 'property' does not exist on type '{ value: number; }'.
  1 | <template>
  2 |   <div id="app">
> 3 |     <p v-for="item in items" :key="item.property">{{ item.value }}</p>
    |                                         ^^^^^^^^
  4 |   </div>
  5 | </template>
`)
  );

  assert.ok(
    stdout.includes(`
18:28 Property 'value' does not exist on type '{ value: number; }[]'. Did you mean 'values'?
  16 |   },
  17 |   methods() {
> 18 |     console.log(this.items.value);
     |                            ^^^^^
  19 |   }
  20 | });
`)
  );
}

exec(`node ${bin} --workspace ${fixtureDir}`, spec);
exec(`node ${bin} --workspace ${fixtureDir} --onlyTypeScript`, spec);
exec(`node ${bin} --workspace ${fixtureDir} --excludeDir ./`, (err, stdout) => {
  assert.equal(Boolean(err), false);
});
exec(`node ${bin} --workspace ${fixtureDir} --excludeDir ./ --excludeDir ./tests`, (err, stdout) => {
  assert.equal(Boolean(err), false);
});
