import * as https from 'https';
import * as dotenv from 'dotenv';

require('dotenv').config();

const readmeApiKey: string = btoa(process.env.README_API_KEY!);
const clientId: string = process.env.CLIENT_ID!;
const clientSecret: string = process.env.CLIENT_SECRET!;
const devPortalDomain: string = 'https://dev.frontapp.com/docs/';

interface Doc {
  url: string;
  title: string;
  content: string;
  source: string;
}

interface Category {
  slug: string;
}

let oauthToken: string = '';

async function getCategories(): Promise<string[]> {
// Retrieve all the Developer Portal documentation categories from Readme
// https://docs.readme.com/main/reference/getcategories
  console.log('Getting all categories from Readme...');
  
  return new Promise((resolve, reject) => {
    const options = {
    hostname: 'dash.readme.com',
    path: '/api/v1/categories?perPage=100',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${readmeApiKey}`,
    },
  };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData: Category[] = JSON.parse(data);
          const slugs = jsonData.map((obj) => obj.slug);
          resolve(slugs);
        } catch (error) {
          reject(new Error(`Get Readme Categories request failed: ${res.statusCode} ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
};

async function getDocSlugs(categories: string[]): Promise<string[]> {
// Get the doc slugs for each category in Readme
// https://docs.readme.com/main/reference/getcategorydocs

  console.log('Getting all docs from each category...');

  let results: string[] = [];

  const dataPromises = categories.map((category) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'dash.readme.com',
        path: `/api/v1/categories/${category}/docs`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${readmeApiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            const docSlugs = getSlugsRecursive(jsonData);
            resolve(docSlugs);
          } catch (error) {
            reject(new Error(`Get Readme Docs in Category request failed: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  });

  const dataArrays = await Promise.all(dataPromises) as Array<string[]>;
  dataArrays.forEach((dataArray: string[]) => {
    results.push(...dataArray);
  });

  return results;
};

function getSlugsRecursive(jsonArray: any[]): string[] {
// Check if the JSON object has children with "slug" keys

  let slugs: string[] = [];

  jsonArray.forEach((json) => {
    if (json.slug) {
      slugs.push(json.slug);
    }

    if (json.children) {
      slugs.push(...getSlugsRecursive(json.children));
    }
  });

  return slugs;
}

async function getDocs(slugs: string[]): Promise<Doc[]> {
// Get the title, url, and body content for each doc based on its slug
// https://docs.readme.com/main/reference/getdoc

  console.log('Getting doc contents...');

  let results: Doc[] = [];

  const dataPromises = slugs.map((slug: string) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'dash.readme.com',
        path: `/api/v1/docs/${slug}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${readmeApiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            const mappedData: Doc = {
              url: devPortalDomain + slug,
              title: jsonData.title,
              content: jsonData.body || jsonData.excerpt || jsonData.title || 'Developer Portal',
              source: 'developerportal'
            };
            resolve(mappedData);
          } catch (error) {
            reject(new Error(`Request Readme Doc Contents request failed: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  });

  const dataArrays = await Promise.all(dataPromises) as Doc[];
  dataArrays.forEach((dataArray: Doc) => {
    results.push(dataArray);
  });

  return results;
};

async function getAuthToken(clientId: string, clientSecret: string): Promise<string> {
// Retrieve an OAuth2 access token with write permissions from the Insided API
// https://api2-eu-west-1.insided.com/docs/#section/Authentication

  console.log('Retrieving an access token from Insided...');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api2-us-west-2.insided.com',
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          const token = jsonData.access_token;
          resolve(token);
        } catch (error) {
          reject(new Error(`Insided OAuth Request failed: ${res.statusCode} ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write('grant_type=client_credentials&client_id=' + clientId + '&client_secret=' + clientSecret + '&scope=write');
    req.end();
  });
};

async function deleteSearchIndex(token: string): Promise<void> {
// Delete the current Developer Portal docs index for the Insided federated search
// https://api2-eu-west-1.insided.com/docs/search/#operation/clear

  console.log('Deleting the Developer Portal federated search index on Insided...');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api2-us-west-2.insided.com',
      path: '/external-content/clear',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 201) {
        resolve();
      } else {
        reject(new Error(`Insided Delete Federated Search Index request failed: ${res.statusCode} ${res.statusMessage}`));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify({ source: 'developerportal' }));
    req.end();
  });
};

async function updateSearchIndex(token: string, data: Doc[]): Promise<void> {
// Index the Developer Portal docs for the Insided federated search
// https://api2-eu-west-1.insided.com/docs/search/#operation/index

  console.log('Updating the Developer Portal federated search index on Insided...');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api2-us-west-2.insided.com',
      path: '/external-content/index',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 201) {
        console.log('Success!');
        resolve();
      } else {
        reject(new Error(`Insided Update Federated Search Index request failed: ${res.statusCode} ${res.statusMessage}`));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify({ batch: data }));
    req.end();
  });
};


/* Main Function */
// Get an Insided OAuth access token
// Get all categories from readme, then get all docs for each category, then get title, URLs, and body content for each doc
// Delete the Insided federated search index for the Developer Portal and then upload the latest content

async function processData(): Promise<void> {
  try {
    const token: string = await getAuthToken(clientId, clientSecret);
    oauthToken = token;
    const categories: string[] = await getCategories();
    const slugs: string[] = await getDocSlugs(categories);
    const docs: Doc[] = await getDocs(slugs);
    await deleteSearchIndex(oauthToken);
    await updateSearchIndex(token, docs);
  } catch (error) {
    console.log(error);
  }
}

processData();