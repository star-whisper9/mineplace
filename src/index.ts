type AppInfo = {
  name: string;
  runtime: string;
};

const appInfo: AppInfo = {
  name: 'node-ts-template',
  runtime: `Node ${process.versions.node}`,
};

console.log(`${appInfo.name} ready on ${appInfo.runtime}`);
