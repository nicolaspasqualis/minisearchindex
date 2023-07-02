import { exec } from 'child_process';
import waitOn from 'wait-on';

export default async function globalSetup(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("Initializing test containers:");
    
    exec('docker-compose -f tests-e2e-docker-compose.yml up -d', (error, stdout, stderr) => {
      if (error) {
        console.error(error);
        return;
      }
      console.log(stdout);
      console.log(stderr);

      const waitingOptions = {
        resources: [ 'tcp:localhost:6379', 'tcp:localhost:27017'],
        delay: 1000,
        interval: 1000,
        timeout: 5000,
      }

      waitOn(waitingOptions, err => {
        if (err) { return reject(err); }
        resolve();
      });
    });
  });
}