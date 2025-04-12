#!/usr/bin/env node
// scripts/generate-firebase-service-account.js
// Script to generate a placeholder Firebase service account file

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Generate a Firebase service account file
 */
async function generateServiceAccount() {
  console.log('Firebase Service Account Generator');
  console.log('=================================');
  console.log('This tool will help you create a Firebase service account configuration.');
  console.log('You should have your Firebase project details ready.');
  console.log();
  
  // Get project details through prompts
  const projectId = await askQuestion('Enter your Firebase project ID: ');
  const privateKey = await askQuestion('Enter your Firebase private key (or press Enter to use a placeholder): ');
  const clientEmail = await askQuestion('Enter your Firebase client email (or press Enter to generate one): ');
  
  // Create service account object
  const serviceAccount = {
    type: 'service_account',
    project_id: projectId,
    private_key_id: generateRandomId(40),
    private_key: privateKey || `-----BEGIN PRIVATE KEY-----\nMIIEvQIB${generateRandomId(60)}\n-----END PRIVATE KEY-----\n`,
    client_email: clientEmail || `firebase-adminsdk-${generateRandomId(6)}@${projectId}.iam.gserviceaccount.com`,
    client_id: generateRandomId(21),
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-${generateRandomId(6)}%40${projectId}.iam.gserviceaccount.com`,
    universe_domain: 'googleapis.com'
  };
  
  // Ask for file location
  const defaultPath = path.resolve(process.cwd(), 'firebase-service-account.json');
  const filePath = await askQuestion(`Enter path to save the service account file (default: ${defaultPath}): `) || defaultPath;
  
  // Write the file
  fs.writeFileSync(
    filePath, 
    JSON.stringify(serviceAccount, null, 2),
    'utf8'
  );
  
  console.log(`\nFirebase service account file saved to: ${filePath}`);
  console.log('\nIMPORTANT: This is a placeholder service account file.');
  console.log('For production use, replace this with your actual Firebase service account.');
  console.log('You can download it from the Firebase Console > Project Settings > Service Accounts.');
  
  // Update .env file if it exists
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update Firebase database URL
      const dbUrl = `https://${projectId}-default-rtdb.firebaseio.com/`;
      if (envContent.includes('FIREBASE_DB_URL=')) {
        envContent = envContent.replace(/FIREBASE_DB_URL=.*/, `FIREBASE_DB_URL=${dbUrl}`);
      } else {
        envContent += `\nFIREBASE_DB_URL=${dbUrl}`;
      }
      
      // Update service account path
      const relativePath = path.relative(process.cwd(), filePath);
      if (envContent.includes('FIREBASE_SERVICE_ACCOUNT_PATH=')) {
        envContent = envContent.replace(/FIREBASE_SERVICE_ACCOUNT_PATH=.*/, `FIREBASE_SERVICE_ACCOUNT_PATH=${relativePath}`);
      } else {
        envContent += `\nFIREBASE_SERVICE_ACCOUNT_PATH=${relativePath}`;
      }
      
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('\n.env file updated with Firebase configuration.');
    }
  } catch (error) {
    console.error('Error updating .env file:', error.message);
  }
}

/**
 * Helper function to ask a question and get a response
 */
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

/**
 * Generate a random ID of specified length
 */
function generateRandomId(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Run the function and close readline interface when done
generateServiceAccount()
  .then(() => {
    rl.close();
  })
  .catch(error => {
    console.error('Error:', error);
    rl.close();
    process.exit(1);
  });