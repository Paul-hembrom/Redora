const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regexCatch = /        } catch \(err\) {\n          logError\('Stream reading error:', err\);\n          if \(!isPlayingNext\) {\n            setIsPlaying\(false\);\n            speakWithBrowser\(\);\n          }\n        }\n      \}\)\(\);\n      \n      logSuccess\('ElevenLabs TTS API call successful, starting chunk playback.'\);\n    } catch \(err\) {\n      logError\('ElevenLabs TTS API call failed:', err\);\n      setIsLoading\(false\);\n      setIsPlaying\(false\);\n      \n      speakWithBrowser\(\);\n    }/;

const newCatch = `        } catch (err) {
          logError('Stream reading error:', err);
          if (!isPlayingNext) {
            setIsPlaying(false);
            showError('Audio unavailable for this content. Please try again later.');
          }
        }
      })();
      
      logSuccess('ElevenLabs TTS API call successful, starting chunk playback.');
    } catch (err) {
      logError('ElevenLabs TTS API call failed:', err);
      setIsLoading(false);
      setIsPlaying(false);
      
      showError('Audio unavailable for this content. Please try again later.');
    }`;

if (regexCatch.test(code)) {
    code = code.replace(regexCatch, newCatch);
    fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
    console.log('patched catch');
} else {
    console.log('regex Catch failed to match');
}
