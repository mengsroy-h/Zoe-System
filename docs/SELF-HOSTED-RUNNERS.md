# Runner ផ្ទាល់ខ្លួន៖ Linux audit ៤ និង Windows APK ១

## ការរៀបចំ

| ការងារ | ប្រព័ន្ធ | ចំនួន | Custom label |
|---|---|---:|---|
| `run-all.sh` | Ubuntu ក្នុង Docker/WSL2 | ៤ | `wsl-zoe-audit` |
| Build APK | Windows ផ្ទាល់ | ១ | `windows-zoe-android` |

Audit មាន shard ទាំង ៤ ហើយ `max-parallel: 4` ឱ្យទាំង ៤អាចរត់ស្របគ្នា ក្នុង mode ទាំងពីរ។ លើ PC ត្រូវមាន Linux runner ៤ Online/Idle ទើបចាប់ job ទាំង ៤បាន; លើ GitHub ក៏អាស្រ័យលើ runner capacity និង quota។ `max-parallel` ជាពិដានក្នុង workflow មួយ; កុំបើក audit ច្រើន branch ព្រមគ្នា។ សាក audit មុន ហើយរង់ចាំចប់មុនចុច build APK។

Runner Linux នីមួយៗមាន Docker network និង home volume ដាច់ពីគ្នា។ Emulator ប្រើ `127.0.0.1:9000` ក្នុង container ផ្ទាល់; កុំបើក host network, កុំ publish port 9000 និងកុំ mount Docker socket ចូល runner។

ឯកសាររបស់ម៉ាស៊ីននៅ [tools/actions-runners](../tools/actions-runners/)។ Workflow នៅ [audit.yml](../.github/workflows/audit.yml) និង [android-release.yml](../.github/workflows/android-release.yml)។ ឯកសារទាំងនេះមិនផ្លាស់ប្ដូរ License ឬ signing key របស់ App ទេ។

## ជ្រើសម៉ាស៊ីនអ្នក ឬម៉ាស៊ីន GitHub

GitHub → repo → Settings → Secrets and variables → Actions → Variables → New repository variable។ បង្កើត `ZOE_RUNNER_MODE`៖

| Value | Audit | APK |
|---|---|---|
| `self-hosted` | Linux runner ៤ ក្នុង WSL | Windows runner របស់អ្នក |
| `github` | `ubuntu-latest` ចំនួន ៤ job | `windows-latest` |

បើមិនមាន variable ឬ value ផ្សេង Workflow ប្រើ self-hosted ជាលំនាំដើម។ ការប្ដូរ value មានប្រសិទ្ធភាពលើ workflow run ថ្មី; វាមិនផ្លាស់ទី job ដែលកំពុងរត់ទេ។ Mode `github` មិនត្រូវការ PC Online; repo Private ត្រូវមាន quota នាទី ឬ billing សម្រាប់ GitHub-hosted។ ការប្ដូរមិនធ្វើស្វ័យប្រវត្តិតាម quota ទេ។

ពេល quota GitHub ត្រឡប់មក កែ value ទៅ `github` រួច Actions → Audit → Run workflow → main; Audit អាចចាប់ job ទាំង ៤ព្រមគ្នា។ Android APK ជ្រើស Windows របស់ GitHub តាម variable ដូចគ្នា។ Workflow នៅតែរក្សា Private និង main/signing guards។

## ១. ដាក់ repo ជា Private

GitHub → repo → Settings → General → Danger Zone → Change repository visibility → Make private។ Workflow ទាំងពីររត់តែពេល repo ជា Private; audit មិនចាប់ PR ពី fork។ ផ្ដល់សិទ្ធិកែ source/workflow តែអ្នកដែលទុកចិត្ត ព្រោះ workflow រត់កូដលើម៉ាស៊ីនអ្នក។ កុំរត់ PR មិនទុកចិត្តលើ PC ផ្ទាល់ខ្លួន។

Self-hosted compute មិនប្រើ quota នាទី GitHub-hosted ទេ; អគ្គិសនី និងធនធានម៉ាស៊ីនជារបស់អ្នក។ Artifact និង cache នៅ GitHub មាន quota ផ្សេង។ Workflow ទាំងពីររក្សា dependency cache ក្នុងម៉ាស៊ីន ដោយបិទ automatic npm cache upload ទៅ GitHub។

Private មិនដក source ដែលគេធ្លាប់ទាញរួចទេ។ GitHub Release របស់ repo Private ក៏ទាមទារសិទ្ធិចូល; ចែកតែ signed APK ទៅអតិថិជនតាមកន្លែងផ្សេង ដោយមិនផ្ដល់សិទ្ធិចូល source repo។

## ២. រៀបចំ WSL2 និង RAM

បើក PowerShell ជា Administrator៖

```powershell
wsl --update
wsl --list --verbose
```

ប្រើ Ubuntu ដែលមាន VERSION `2`។ បើមិនទាន់មាន៖

```powershell
wsl --install -d Ubuntu-24.04
```

Restart បើ Windows ស្នើ ហើយបើក Ubuntu បង្កើត Linux username/password។ បើ distro មាន VERSION `1` ប្រើ `wsl --set-version <ឈ្មោះ-distro> 2` ជាមួយឈ្មោះពិតពីបញ្ជី។

បើក `%USERPROFILE%\.wslconfig`៖

```powershell
notepad "$env:USERPROFILE\.wslconfig"
```

បញ្ចូល ឬកែ key ក្នុង section ដែលមានស្រាប់៖

```ini
[wsl2]
memory=12GB
processors=8
swap=4GB
```

`processors` គឺ CPU logical មិនមែនចំនួន runner; បើមានតិចជាង 8 ប្រើចំនួនដែលមាន។ RAM 12GB ជាពិដានរួមរបស់ WSL2 ទាំងអស់ សម្រាប់សាក audit ៤ស្របគ្នា; លើ PC RAM 16GB វានៅសល់ប្រហែល 4GB សម្រាប់ Windows។ បិទកម្មវិធីធ្ងន់ និងមើលការប្រើ RAM ពិត; ប្រសិនបើមាន OOM ត្រូវកាត់ parallel ឬប្រើ GitHub mode។ បិទការងារ WSL មុន `wsl --shutdown` ព្រោះវាបញ្ឈប់ distro និង Docker ដែលកំពុងធ្វើការ។ បន្ទាប់មកបើក Docker/Ubuntu ឡើងវិញ។

## ៣. Docker Desktop

ដំឡើង Docker Desktop for Windows ពី [Docker](https://docs.docker.com/desktop/setup/install/windows-install/)។ បើក៖

- Settings → General → Use WSL 2 based engine។
- Settings → Resources → WSL Integration → Ubuntu របស់អ្នក → Apply។
- ប្រើ Linux containers។

ការរៀបចំនេះប្រើ Docker Desktop មួយ; កុំដំឡើង Docker daemon ទីពីរក្នុង Ubuntu ព្រមគ្នា។ ក្នុង Ubuntu ពិនិត្យ `docker version` និង `docker compose version`។

ទុកទំហំ SSD គ្រប់គ្រាន់សម្រាប់ image, SDK និង node_modules។ ប្រើ `docker system df` និង Windows disk settings ដើម្បីពិនិត្យទំហំជាក់ស្ដែង។

## ៤. ទាញ source និង build Linux image

បើមាន source រួច ចូល checkout ដែលមាន workflow និង `tools/actions-runners` ទាំងនេះ។ បើមិនទាន់មាន ក្នុង Ubuntu៖

```bash
sudo apt-get update
sudo apt-get install -y git gh
gh auth login
mkdir -p ~/src
cd ~/src
gh repo clone mengsroy-h/Zoe-System
cd Zoe-System
```

`gh auth login` ជ្រើស GitHub.com និង HTTPS ហើយ sign in តាម browser។ ធ្វើតែក្នុង Ubuntu របស់អ្នក; កុំចម្លង personal token ចូល file។ បើការកែនៅ branch មិនទាន់ merge ប្រើ `git switch codex/self-hosted-wsl-windows-runners` មុន build។

```bash
cd tools/actions-runners
docker build -t zoe-actions-runner:local .
```

ធ្វើក្នុង Linux home ដូច `~/src` ដើម្បីកាត់ការងារ file តូចៗឆ្លង `/mnt/c`។ Image ដំឡើង Linux browser dependencies ជាមុន; workflow មិនស្នើ password sudo។ Runner tarball មាន SHA-256 check ហើយ runner auto-update នៅបើក។

បញ្ឈប់ runner ចាស់ដែលនៅប្រើ RAM ពេលវាទំនេរ។ បើ native Linux service ប្រើ `sudo ./svc.sh stop` ពី directory របស់ runner នីមួយៗ។ បើរត់ `./run.sh` ក្នុង terminal ប្រើ Ctrl+C។ កុំលុបការងាររបស់ runner កំពុងធ្វើ job។

## ៥. Register Linux runner ៤

GitHub → repo → Settings → Actions → Runners → New self-hosted runner → Linux → x64។ យក registration token ពី command `./config.sh --url ... --token ...`។ Token នេះមានអាយុមួយម៉ោង; មិនមែន PAT និងមិនមែន workflow `GITHUB_TOKEN`។

ក្នុង directory `tools/actions-runners`៖

```bash
bash register.sh
docker compose up -d
docker compose ps
docker compose logs --tail=50
```

Script ស្នើ token ដោយលាក់អក្សរ និង register runner ៤៖ `Zoe-WSL-Audit-1` ដល់ `Zoe-WSL-Audit-4`។ វាមិនរក្សា token ក្នុង Docker environment ឬ compose file ទេ។ នៅ GitHub ត្រូវឃើញ Online/Idle មាន labels `self-hosted`, `Linux`, `X64`, `wsl-zoe-audit`។

Runner មួយមាន RAM cap 3GB និង CPU quota 2; cap មិនមែន RAM កក់ពេល idle ទេ។ Browser checker ម្តងមួយ និង run-all lane អតិបរមា ២ក្នុង shard។ មិនអះអាងថា RAM 16GB គ្រប់គ្រាន់សម្រាប់ build ធ្ងន់ទាំង ៥ព្រមគ្នាទេ។

## ៦. ដំឡើង Windows runner សម្រាប់ APK

ដំឡើង [Git for Windows](https://git-scm.com/downloads/win) និង [GitHub CLI](https://cli.github.com/) ក្នុង Windows ឱ្យមានក្នុង PATH។ បើក PowerShell window ថ្មី៖

```powershell
git --version
gh --version
& 'C:\Program Files\Git\bin\bash.exe' -lc 'command -v cygpath; command -v base64; command -v sha256sum'
```

ប្រើផ្លូវ Git ពិតបើដំឡើងនៅកន្លែងផ្សេង។ Workflow ប្រើ Git Bash សម្រាប់ logic ដែលមានស្រាប់ និង PowerShell ដែលមានស្រាប់ដើម្បីហៅ Windows `gradlew.bat`/`apksigner.bat`។ APK build មិនប្រើ WSL។ Node, Java និង Android command-line SDK ដំឡើងតាម workflow; មិនចាំបាច់ដំឡើង Android Studio។

GitHub → repo → Settings → Actions → Runners → New self-hosted runner → **Windows → x64**។ ក្នុង PowerShell ជា Administrator បង្កើត `C:\actions-runner-apk` ហើយ **ប្រើ download/extract និង checksum commands ដែល GitHub បង្ហាញសម្រាប់ Windows**។ កុំប្រើ Linux tarball ជំនួស។

ក្រោយ extract៖

```powershell
Set-Location C:\actions-runner-apk
.\config.cmd --url https://github.com/mengsroy-h/Zoe-System --token YOUR_REGISTRATION_TOKEN --name Zoe-Windows-APK --labels windows-zoe-android
```

ប្ដូរ `YOUR_REGISTRATION_TOKEN` ដោយ token ថ្មីពីទំព័រ Windows។ ជ្រើស work folder `_work`។ ពេលសួរ Run runner as a service ជ្រើស `Y` បើចង់ឱ្យឡើងក្រោយ reboot។ Service account ត្រូវមានសិទ្ធិសរសេរ directory និងឃើញ Git/gh ក្នុង PATH; ប្រើ account ដែលទុកចិត្ត និងមិនរត់ build ជា Administrator ជាប្រចាំ។

បើសាកដោយមិន install service៖

```powershell
.\run.cmd
```

ទុក terminal បើក។ កុំរត់ terminal និង service នៃ runner ដូចគ្នាព្រមគ្នា។ Windows service ពិនិត្យដោយ `Get-Service 'actions.runner.*'`។ បើទើបដំឡើង Git/gh ត្រូវ restart service ដើម្បី refresh PATH។

នៅ GitHub ត្រូវឃើញ `Zoe-Windows-APK` Online មាន labels `self-hosted`, `Windows`, `X64`, `windows-zoe-android`។

## ៧. សាក workflow

Workflow ត្រូវមានក្នុង branch ដែលជ្រើស។ Audit មាន Run workflow ប៊ូតុងក្រោយ workflow បានដាក់ក្នុង default branch; PR ក្នុង repo ដដែលក៏ចាប់ audit ពេល repo Private។

១. Repo Private និង Linux runner Online → Actions → Audit → Run workflow → main។ ពិនិត្យ shard ទាំង ៤ បៃតង និង STRICT ទាំង ៥ មិន SKIP។

២. រង់ចាំ audit ចប់ → Actions → Android APK → Run workflow → main។ Windows runner ត្រូវ Online។ APK release មាន main guard ដូច្នេះ branch ផ្សេង skip។

Secret ដើមទាំង ៤ ត្រូវមាន៖ `ZOEW_KEYSTORE_BASE64`, `ZOEW_KEYSTORE_PASSWORD`, `ZOEW_KEY_ALIAS`, `ZOEW_KEY_PASSWORD`។ **ប្រើ keystore ដើម** ដើម្បីដំឡើងជាន់ App ចាស់បាន។ `ZOEW_GOOGLE_SERVICES_JSON` ជា secret ស្រេចចិត្តសម្រាប់ FCM។

បើ version មាន Release រួច workflow skip build ដោយត្រឹមត្រូវ។ កុំឡើង APP_VERSION ទទេដើម្បីសាក runner; រង់ចាំ release កំណែបន្ទាប់ពិតប្រាកដ។ ការសាកដែល skip មិនបញ្ជាក់ Gradle/signing ពេញទេ។ SDK action ទទួលយក Android SDK licenses ដោយស្វ័យប្រវត្តិ។

## ៨. ថែទាំ និងដោះស្រាយកំហុស

ក្នុង self-hosted mode Linux ត្រូវការ Docker Desktop បើក។ Windows runner ត្រូវការ service ឬ `run.cmd` បើក។ PC ត្រូវភ្ញាក់ មានភ្លើង និងអ៊ីនធឺណិត។ កំណត់ Docker Desktop Start when you sign in និង Windows Sleep ពេលដោតភ្លើងឱ្យសមនឹង CI។ Docker `restart: unless-stopped` មិនដាស់ Windows ឬបើក Docker Desktop ដោយខ្លួនឯងទេ។

ក្នុង Ubuntu ពី `tools/actions-runners`៖

```bash
docker stats
docker system df
docker compose logs --tail=100 audit-1
```

Ctrl+C បិទការមើល stats។ បញ្ឈប់ runner ពេលគ្មាន job ដោយ `docker compose stop`; បើកវិញដោយ `docker compose up -d`។ កុំប្រើ `down -v` បើមិនចង់បាត់ registration/cache។ បើ rebuild image សម្រាប់ dependencies ថ្មី ប្រើ `docker compose up -d --force-recreate` ពេលគ្មាន job ហើយរក្សា volumes។

| រោគសញ្ញា | ពិនិត្យ |
|---|---|
| Waiting for a runner | ពិនិត្យ `ZOE_RUNNER_MODE`; ក្នុង self-hosted mode ពិនិត្យ Online, OS/X64 និង custom label |
| Job ទាំងអស់ skipped | Repo នៅ Public, PR ពី fork ឬ Android branch មិនមែន main |
| sudo terminal error | self-hosted step មិនហៅ sudo; sudo និង --with-deps ត្រូវរត់តែ step GitHub mode |
| Emulator port ជាន់ | Runner ត្រូវជា container ដាច់ៗ គ្មាន host network |
| bash/gh/cygpath រកមិនឃើញ | Git for Windows/GitHub CLI និង restart service ដើម្បី refresh PATH |
| SDK location not found | SDK setup ក្រោយ Java, ANDROID_HOME និង service account permissions |
| Exit 137 | អាចជា memory kill; បញ្ជាក់ពី logs និង OOMKilled មុនសន្និដ្ឋាន |
| Token invalid | យក registration token ថ្មីពី OS ដែលត្រឹមត្រូវ |
| Runner name already exists | ពិនិត្យ runner ដែលមានស្រាប់; script មិនប្រើ --replace ដោយស្វ័យប្រវត្តិ |

បើ RAM តឹង កំណត់ `max-parallel: 1` និង `RUNALL_JOBS: '1'` ជាមុន។ កុំបិទ STRICT ឬបង្កើន checker timeout ដើម្បីឱ្យបៃតង។

`backup.yml` នៅប្រើ GitHub-hosted runner; ការកែ audit/APK នេះមិនដោះស្រាយ quota របស់ backup ទេ។ ការប្ដូរ backup ត្រូវគិតពី PC Online ពេល cron និង artifact quota។

## ប្រភពផ្លូវការ

- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Adding self-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)
- [WSL configuration](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
- [Docker Desktop WSL2](https://docs.docker.com/desktop/features/wsl/)
- [Android SDK action](https://github.com/android-actions/setup-android)
