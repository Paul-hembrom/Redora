import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

// Unsplash
content = content.replace(
`          if (imgs.length === 0 && unsplashKey) {
            try {
              const unsplashRes = await fetch(\`https://api.unsplash.com/search/photos?query=\${encodeURIComponent(query)}&per_page=3\`, {
                headers: { Authorization: \`Client-ID \${unsplashKey}\` }
              });
              if (unsplashRes.ok) {`,
`          if (imgs.length === 0 && unsplashKey) {
            try {
              const unsplashUrl = \`https://api.unsplash.com/search/photos?query=\${encodeURIComponent(query)}&per_page=3\`;
              console.warn(\`[Unsplash] Requesting URL: \${unsplashUrl}\`);
              const unsplashRes = await fetch(unsplashUrl, {
                headers: { Authorization: \`Client-ID \${unsplashKey}\` }
              });
              const unsplashText = await unsplashRes.clone().text();
              console.warn(\`[Unsplash] Response Status: \${unsplashRes.status}, Body: \${unsplashText.substring(0, 200)}\`);
              if (unsplashRes.ok) {`);

content = content.replace(
`                  }
                }
              }
            } catch (err) {}
          }

          if (imgs.length === 0) {`,
`                  }
                }
              }
            } catch (err: any) { console.warn(\`[Unsplash] Error: \${err.message}\`); }
          }

          if (imgs.length === 0) {`);

// Wikimedia
content = content.replace(
`          if (imgs.length === 0) {
            try {
              const wikiUrl = \`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=\${encodeURIComponent(query + " diagram")}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*\`;
              const wikiRes = await fetch(wikiUrl);
              if (wikiRes.ok) {`,
`          if (imgs.length === 0) {
            try {
              const wikiUrl = \`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=\${encodeURIComponent(query + " diagram")}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*\`;
              console.warn(\`[Wikimedia] Requesting URL: \${wikiUrl}\`);
              const wikiRes = await fetch(wikiUrl);
              const wikiText = await wikiRes.clone().text();
              console.warn(\`[Wikimedia] Response Status: \${wikiRes.status}, Body: \${wikiText.substring(0, 200)}\`);
              if (wikiRes.ok) {`);

content = content.replace(
`                }
              }
            } catch (err) {}
          }
          return imgs;
        }`,
`                }
              }
            } catch (err: any) { console.warn(\`[Wikimedia] Error: \${err.message}\`); }
          }
          return imgs;
        }`);

// Relevance Check
content = content.replace(
`        // Relevance check
        if (images.length > 0) {
           const combinedText = images.map(img => (img.alt || "").toLowerCase()).join(" ");
           const titleWords = title.toLowerCase().split(/\\s+/);
           const checkWords = [...titleWords].filter(w => w.length > 2);
           const isRelevant = checkWords.some(w => combinedText.includes(w));
           if (!isRelevant && checkWords.length > 0) {
              const broaderQuery = title.trim();
              const retryImages = await fetchImagesForQuery(broaderQuery);
              if (retryImages.length > 0) {
                 images = retryImages;
              }
           }
        }`,
`        // Relevance check
        if (images.length > 0) {
           const combinedText = images.map(img => (img.alt || "").toLowerCase()).join(" ");
           const titleWords = title.toLowerCase().split(/\\s+/);
           const checkWords = [...titleWords].filter(w => w.length > 2);
           const isRelevant = checkWords.some(w => combinedText.includes(w));
           if (!isRelevant && checkWords.length > 0) {
              console.warn(\`[Relevance Check] Failed for query: \${searchQuery}. Falling back to broader query: \${title.trim()}\`);
              const broaderQuery = title.trim();
              const retryImages = await fetchImagesForQuery(broaderQuery);
              if (retryImages.length > 0) {
                 images = retryImages;
              }
           } else {
              console.warn(\`[Relevance Check] Passed for query: \${searchQuery}\`);
           }
        }`);

// YouTube
content = content.replace(
`          if (parsedVid.recommended_videos) {
            for (const vid of parsedVid.recommended_videos.slice(0, 3)) {
              try {
                const searchResult = await ytSearch(vid.search_query_used || vid.title);
                if (searchResult && searchResult.videos.length > 0) {`,
`          if (parsedVid.recommended_videos) {
            for (const vid of parsedVid.recommended_videos.slice(0, 3)) {
              try {
                console.warn(\`[YouTube] Requesting search query: \${vid.search_query_used || vid.title}\`);
                const searchResult = await ytSearch(vid.search_query_used || vid.title);
                console.warn(\`[YouTube] Response received. Found \${searchResult?.videos?.length || 0} videos.\`);
                if (searchResult && searchResult.videos.length > 0) {`);

content = content.replace(
`                  });
                }
              } catch(e) {}
            }
          }
        } catch(e) {}`,
`                  });
                }
              } catch(e: any) { console.warn(\`[YouTube] Error: \${e.message}\`); }
            }
          }
        } catch(e: any) { console.warn(\`[YouTube] LLM parsing error: \${e.message}\`); }`);

fs.writeFileSync('server.ts', content);
console.log('done');
