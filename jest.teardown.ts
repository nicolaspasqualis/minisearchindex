import { exec } from 'child_process';

export default function globalTeardown(): Promise<void> {
    return new Promise((resolve, reject) => {
        exec('docker-compose -f tests-e2e-docker-compose.yml down', (error) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });
    });
}