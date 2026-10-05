# ដំឡើង GitHub Actions៖ Linux runner ៤ ក្នុង WSL និង Windows runner ១សម្រាប់ APK

ឯកសារនេះសម្រាប់ Windows, Core i5 ជំនាន់ទី 13 និង RAM 16GB។ ធ្វើតាមលំដាប់ ហើយមើលលទ្ធផលនៅចុងជំហាននីមួយៗ មុនបន្ត។ បើជំហានណាបានធ្វើរួច និងពិនិត្យឆ្លង អាចរំលងទៅជំហានបន្ទាប់។

## មុនចាប់ផ្ដើម៖ យើងកំពុងរៀបចំអ្វី?

| ការងារ | កន្លែងរត់លើម៉ាស៊ីនអ្នក | ចំនួន | Custom label |
|---|---|---:|---|
| Audit / `run-all.sh` | Linux container ក្នុង Docker Desktop និង WSL2 | ៤ | `wsl-zoe-audit` |
| Build APK | Windows ផ្ទាល់ | ១ | `windows-zoe-android` |

Linux runner ទាំង ៤មាន home/cache និង network ដាច់ពីគ្នា។ ដូច្នេះ emulator នីមួយៗអាចប្រើ port 9000 ក្នុង container ផ្ទាល់បាន។ Workflow អនុញ្ញាត audit shard ទាំង ៤រត់ព្រមគ្នា (`max-parallel: 4`); ត្រូវមាន runner ទំនេរទាំង ៤ទើបចាប់ job ទាំង ៤បាន។ កុំបើក audit ច្រើន branch ព្រមគ្នា។

RAM 16GB ត្រូវសាកការប្រើជាក់ស្ដែង។ WSL cap 12GB ក្នុងការណែនាំនេះជាពិដាន មិនមែន RAM ដែលកក់ជានិច្ចទេ។ Runner មួយមាន cap 3GB និង CPU quota 2។ ពេលសាកដំបូង បិទកម្មវិធីធ្ងន់ ហើយរង់ចាំ Audit ចប់មុនសាក APK។ បើ memory មិនគ្រប់ ត្រូវកាត់ parallel ឬប្រើ GitHub mode; កុំបិទ STRICT ដើម្បីឱ្យ test បៃតង។

ឯកសារប្រតិបត្តិ៖ [runner kit](../tools/actions-runners/), [Audit workflow](../.github/workflows/audit.yml), [APK workflow](../.github/workflows/android-release.yml)។

## ១. បែងចែក PowerShell និង Ubuntu ឱ្យច្បាស់

Windows និង Ubuntu មាន terminal ផ្សេងគ្នា។ មើល prompt ខាងឆ្វេងមុន copy command។

| Terminal | Prompt ដែលជួបញឹកញាប់ | Command ដែលប្រើនៅទីនោះ |
|---|---|---|
| Windows PowerShell | `PS C:\Users\...>` | `wsl`, `notepad`, `config.cmd`, `run.cmd` |
| Ubuntu / WSL | `username@computer:~$` | `sudo apt-get`, `cd ~/src`, `bash register.sh`, Docker Linux |

Code block ដែលមានពាក្យ **PowerShell** រត់ក្នុង Windows។ Code block ដែលមានពាក្យ **Ubuntu** រត់ក្នុង Ubuntu។ Copy តែ command ក្នុង block; កុំវាយ prompt `PS ...>` ឬ `$` ចូលជាមួយ។

`cd` មានន័យថាប្ដូរ folder។ ក្នុង Ubuntu `cd ~` ចូល Linux home; វាមិនបើក browser និងមិន login GitHub ទេ។

**ចំណុចត្រូវឆ្លង៖** អ្នកអាចបែងចែក terminal ទាំងពីរបាន។ `sudo apt-get` ក្នុង PowerShell បង្ហាញ Command not found ព្រោះវាជា Linux command។

## ២. ពិនិត្យ និងដំឡើង WSL2

**កន្លែងរត់៖ PowerShell ជា Administrator។** Start → វាយ PowerShell → ចុចស្ដាំ → Run as administrator។

ពិនិត្យ distro ដែលមានស្រាប់៖

```powershell
wsl --list --verbose
```

មើលជួរឈរ NAME និង VERSION។ ឧទាហរណ៍ NAME អាចជា `Ubuntu-24.04` ឬ `Ubuntu`។ កុំជ្រើស `docker-desktop` ជា terminal សម្រាប់ការដំឡើងនេះ។

បើមាន Ubuntu និង VERSION `2` រួច រំលងការដំឡើង ហើយទៅជំហានទី ៣។ បើមិនមាន Ubuntu៖

```powershell
wsl --install -d Ubuntu-24.04
```

Restart Windows ប្រសិនបើវាស្នើ។ បន្ទាប់មក Start → វាយ Ubuntu → បើក distro ដែលទើបដំឡើង។ ពេលបើកដំបូង បង្កើត Linux username និង password។ ពេលវាយ password ក្នុង Ubuntu អក្សរមិនបង្ហាញលើអេក្រង់ទេ; វាយហើយ Enter។

កែ WSL ឱ្យទាន់សម័យ៖

```powershell
wsl --update
wsl --list --verbose
```

បើ Ubuntu ជា VERSION `1` ត្រូវប្ដូរទៅ `2`។ ប្រើឈ្មោះពិតដែលបង្ហាញក្នុង NAME។ ឧទាហរណ៍សម្រាប់ `Ubuntu-24.04`៖

```powershell
wsl --set-version Ubuntu-24.04 2
```

**ចំណុចត្រូវឆ្លង៖** មាន Ubuntu និង VERSION `2`។

## ៣. កំណត់ RAM និង CPU របស់ WSL

**កន្លែងរត់៖ PowerShell។**

បើក file កំណត់ WSL៖

```powershell
notepad "$env:USERPROFILE\.wslconfig"
```

បើ Notepad សួរបង្កើត file ថ្មី ជ្រើស Yes។ ដាក់ខ្លឹមសារនេះ៖

```ini
[wsl2]
memory=12GB
processors=8
swap=4GB

[experimental]
autoMemoryReclaim=gradual
```

បើ file មានកំណត់ស្រាប់ កែ keys ក្នុង sections ដដែល។ `processors=8` មានន័យ logical processors មិនមែន runner ចំនួន ៨ទេ។ ប្រសិនបើម៉ាស៊ីនមាន logical processors តិចជាង ៨ ប្រើចំនួនដែលមាន។

ក្នុង Notepad ចុច File → Save។ បើប្រើ Save As៖ Save as type ជ្រើស All files ហើយ File name ដាក់ `.wslconfig` ក្នុង Windows user folder (`C:\Users\ឈ្មោះគណនីWindows`)។ ពិនិត្យថាមិនបានក្លាយជា `.wslconfig.txt`។ File គំរូមាននៅ [.wslconfig.example](../tools/actions-runners/.wslconfig.example)។ RAM cap នេះគ្រប WSL2 ទាំងអស់រួមទាំង Docker។

បិទការងារ WSL និង Docker ដែលកំពុងធ្វើការមុន command ខាងក្រោម ព្រោះវាបញ្ឈប់ WSL ទាំងអស់៖

```powershell
wsl --shutdown
```

បន្ទាប់មកបើក Docker Desktop និង Ubuntu ឡើងវិញ។

**ចំណុចត្រូវឆ្លង៖** File រក្សាទុកត្រឹមត្រូវ ហើយ WSL បានចាប់ផ្ដើមឡើងវិញ។

## ៤. ដំឡើង Docker Desktop និងភ្ជាប់ Ubuntu

**កន្លែងធ្វើ៖ Windows browser និងកម្មវិធី Docker Desktop។**

១. ទាញ installer ពី [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)។

២. ដំឡើង និងបើក Docker Desktop។ Restart ប្រសិនបើ installer ស្នើ។

៣. Docker Desktop → Settings → General → បើក **Use WSL 2 based engine**។

៤. Settings → Resources → WSL Integration → បើក Ubuntu របស់អ្នក → Apply/Restart។

៥. ប្រើ Linux containers។ ការរៀបចំនេះប្រើ Docker Desktop មួយ; មិនត្រូវដំឡើង Docker daemon ទីពីរក្នុង Ubuntu ព្រមគ្នា។

**កន្លែងរត់ command បន្ទាប់៖ Ubuntu។** បើកតាម Start → Ubuntu ឬក្នុង PowerShell ប្រើឈ្មោះ distro ពិត ឧទាហរណ៍៖

```powershell
wsl -d Ubuntu-24.04
```

ក្នុង Ubuntu៖

```bash
docker version
docker compose version
```

`docker version` ត្រូវឃើញព័ត៌មាន Client និង Server។ `docker compose version` ត្រូវឃើញ version។ បើឃើញតែ Client ហើយ Server connection error៖ បើក Docker Desktop រង់ចាំ engine ដំណើរការ រួចសាកវិញ។ បើ command រកមិនឃើញ៖ ពិនិត្យ WSL Integration សម្រាប់ distro ដែលអ្នកកំពុងប្រើ ហើយបើក Ubuntu terminal ថ្មី។

**ចំណុចត្រូវឆ្លង៖** Docker Client/Server និង Compose ឆ្លើយតបក្នុង Ubuntu។ កុំទៅ build image មុនចំណុចនេះឆ្លង។

## ៥. ដំឡើង Git និង GitHub CLI ក្នុង Ubuntu

**កន្លែងរត់៖ Ubuntu។**

```bash
sudo apt-get update
sudo apt-get install -y git gh
git --version
gh --version
```

ពេល sudo សួរ password ប្រើ Linux password ពីពេលបង្កើត Ubuntu។ វាមិនបង្ហាញអក្សរពេលវាយ។

**ចំណុចត្រូវឆ្លង៖** Command ទាំងពីរបង្ហាញ version។ Git/gh ដែលដំឡើងក្នុង Windows និងក្នុង Ubuntu ជាការដំឡើងផ្សេងគ្នា។

## ៦. Login GitHub ក្នុង Ubuntu ដោយ browser Windows

**កន្លែងចាប់ផ្ដើម៖ Ubuntu។**

```bash
gh auth login
```

ជ្រើសតាមលំដាប់៖

| សំណួរលើ terminal | ជម្រើស |
|---|---|
| Where do you use GitHub? | GitHub.com |
| Preferred protocol? | HTTPS |
| Authenticate Git with your GitHub credentials? | Yes |
| How would you like to authenticate? | Login with a web browser |

វានឹងបង្ហាញ one-time code ហើយស្នើ Enter ដើម្បីបើក browser។ ប្រសិនបើ browser បើក សូមបញ្ចូល code និង Authorize GitHub CLI។

### បើបង្ហាញ Failed opening a web browser / xdg-open not found

នេះមានន័យ WSL មិនមានកម្មវិធីបើក browser។ អាច authorize ដោយ browser Windows៖

១. ទុក Ubuntu terminal ដែលកំពុង login បើក។

២. Scroll ឡើងរកបន្ទាត់ one-time code ដែលវាបង្ហាញមុន error។

៣. បើក Chrome/Edge ក្នុង Windows ចូល [github.com/login/device](https://github.com/login/device)។

៤. បញ្ចូល code ពី Ubuntu → ចូលគណនីដែលមានសិទ្ធិ repo → Authorize GitHub CLI។

៥. ត្រឡប់ Ubuntu រង់ចាំ login បញ្ចប់។

បើ code ផុតកំណត់ ចុច Ctrl+C ហើយចាប់ផ្ដើម login ឡើងវិញ។ អាចប្រើ command នេះ៖

```bash
gh auth login --hostname github.com --git-protocol https --web
```

ក្រោយ login បញ្ចប់៖

```bash
gh auth status
```

**ចំណុចត្រូវឆ្លង៖** `gh auth status` បង្ហាញថាចូល GitHub.com និងគណនីត្រឹមត្រូវ។ ការចូលក្នុង Windows មិនជំនួសការចូលក្នុង Ubuntu ទេ។

### Code និង token ដែលជួបក្នុងការដំឡើង

| អ្វីដែលវាសួរ | យកមកពីណា | ប្រើធ្វើអ្វី |
|---|---|---|
| One-time code របស់ `gh auth login` | Ubuntu terminal បង្ហាញ | បញ្ចូលក្នុង browser ដើម្បី login |
| Linux registration token | Repo Settings → Actions → Runners → New self-hosted runner → Linux/x64 | `bash register.sh` សម្រាប់ runner ៤ |
| Windows registration token | ទំព័រ New self-hosted runner → Windows/x64 | `config.cmd` សម្រាប់ APK runner |
| `ZOE_RUNNER_MODE` | អ្នកកំណត់ជា Repository variable | ជ្រើស `github` ឬ `self-hosted`; វាមិនមែន token |

Self-runner registration token មិនប្រើដើម្បី login `gh auth login` ទេ។ ប្រើ browser flow ខាងលើសម្រាប់ login។

## ៧. ទាញ source ទុកក្នុង Linux home

**កន្លែងរត់៖ Ubuntu។** ទាញម្ដងសម្រាប់ build image និង register runner ៤; មិនចាំបាច់ទាញ source ៤ដង។

### ករណី A៖ មិនទាន់មាន repo ក្នុង Ubuntu

```bash
mkdir -p ~/src
cd ~/src
gh repo clone mengsroy-h/Zoe-System
cd Zoe-System
```

`~/src/Zoe-System` គឺ folder ក្នុង Linux home។ វាមិនមែន Windows Desktop ទេ។ ទុក source នៅទីនេះដើម្បីកាត់ការងារ file តូចៗឆ្លង `/mnt/c`។

### ករណី B៖ មាន repo នៅទីនេះរួច

```bash
cd ~/src/Zoe-System
git status
git fetch origin
```

បើ repo របស់អ្នកនៅ folder ផ្សេង ត្រូវ `cd` ទៅទីតាំងពិត។ បើ clone ប្រាប់ថា destination មានរួច ប្រើករណី B។

### ជ្រើស branch ដែលមាន runner kit

បើការកែនៅ [PR #286](https://github.com/mengsroy-h/Zoe-System/pull/286) មិនទាន់ merge៖

```bash
git fetch origin
git switch codex/self-hosted-wsl-windows-runners
git pull --ff-only
```

បើ PR បាន merge ចូល main រួច ជ្រើស main៖

```bash
git switch main
git pull --ff-only
```

ជ្រើស block ដែលត្រូវនឹងស្ថានភាព PR។ បើ Git បដិសេធ switch/pull ដោយមាន local changes ត្រូវពិនិត្យឯកសារដែលអ្នកបានកែមុន; កុំបង្ខំលុបការកែរបស់អ្នក។

ពិនិត្យទីតាំង៖

```bash
pwd
ls tools/actions-runners
```

ត្រូវឃើញ `Dockerfile`, `compose.yml` និង `register.sh`។ `pwd` ត្រូវចង្អុលទៅ repo ក្នុង Linux home។ ចង់មើល folder នោះក្នុង Windows File Explorer អាចរត់ពី Ubuntu៖

```bash
explorer.exe .
```

**ចំណុចត្រូវឆ្លង៖** Repo មាន runner kit និង branch ត្រឹមត្រូវ។ ក្រោយមក workflow នឹងទាញ source សម្រាប់ job ដោយ `actions/checkout` ស្វ័យប្រវត្តិ។ Windows APK runner ក៏ checkout ដោយ workflow ដូចគ្នា។

## ៨. បង្កើត Linux runner image

**កន្លែងរត់៖ Ubuntu ក្នុង repo។**

```bash
cd ~/src/Zoe-System/tools/actions-runners
docker build -t zoe-actions-runner:local .
```

បើ repo នៅ folder ផ្សេង ប្រើទីតាំងពិត។ សញ្ញា `.` ចុង command មានន័យ build ដោយយក Dockerfile ក្នុង folder បច្ចុប្បន្ន; ត្រូវមានវា។

ការបង្កើត image ដំបូងទាញ Node 24, Java/OpenJDK 21, Linux dependencies និង runner application ម្ដង។ Linux runners ទាំង ៤ប្រើ image ដូចគ្នា; self-hosted Audit ផ្ទៀងកំណែ Node/Java ដែលមានរួច ហើយមិនទាញ runtime ទាំងនេះក្នុង job ទៀត។ GitHub mode ប្រើ setup actions របស់ GitHub។ Image រៀបចំ browser system dependencies ជាមុន; self-hosted workflow មិនស្នើ sudo password ពេលដំឡើង Chromium។ Runner tarball មាន SHA-256 check ហើយ runner auto-update នៅបើក។

ពិនិត្យក្រោយ build៖

```bash
docker image inspect zoe-actions-runner:local
```

ត្រូវឃើញព័ត៌មាន image ហើយគ្មាន error No such image។ បើ build ធ្លាក់ ពិនិត្យ error ចុងក្រោយ និង command ដែលធ្លាក់ មុនបន្ត។

ឆែក runtime ក្នុង image ដោយមិន register runner ថ្មី៖

```bash
docker run --rm --entrypoint bash zoe-actions-runner:local -c 'node --version; java -version; javac -version'
```

ត្រូវឃើញ Node `v24...` និង Java/javac `21...`។ Command នេះមិនបើក runner application និងមិនភ្ជាប់ runner home volumes ទេ។

**ចំណុចត្រូវឆ្លង៖** Image `zoe-actions-runner:local` មានក្នុង Docker។

## ៩. Register Linux runner ទាំង ៤ដោយ script ម្ដង

**កន្លែងយក token៖ Windows browser → GitHub repo។**

១. បើក `mengsroy-h/Zoe-System` → Settings។

២. Sidebar → Actions → Runners → New self-hosted runner។

៣. ជ្រើស Linux និង x64។

៤. ក្នុងផ្នែក Configure រក command ដែលមាន `./config.sh --url ... --token ...`។ Copy តែតម្លៃនៅក្រោយ `--token`។

Token មានអាយុមួយម៉ោង។ យក token ក្រោយ image build រួច ដើម្បីកុំឱ្យវាផុតពេលរង់ចាំ build។ Script របស់យើង register ទាំង ៤ដោយ token ដែលបញ្ចូលម្ដង។ មិនត្រូវរត់ Linux download/config commands ពីទំព័រ GitHub ដោយដៃទៀតសម្រាប់ Docker runner kit នេះទេ។

**កន្លែងរត់៖ Ubuntu។**

```bash
cd ~/src/Zoe-System/tools/actions-runners
bash register.sh
```

ពេលវាសួរ token៖ paste token → Enter។ អក្សរមិនបង្ហាញពេល paste ព្រោះ script លាក់ input។

Script នឹងចុះឈ្មោះ `audit-1`, `audit-2`, `audit-3`, `audit-4` តាមលំដាប់។ បើមានកំហុស វាបញ្ឈប់នៅ runner ដែលខុស; កែបញ្ហា និងយក token ថ្មីបើផុតកំណត់ រួចរត់ script វិញ។ Runner ដែលមាន config រួចត្រូវបានរំលង។

**ចំណុចត្រូវឆ្លង៖** Script បញ្ចប់ដោយគ្មាន registration error។ Runner អាចនៅ Offline មុនបើក container ក្នុងជំហានបន្ទាប់។

## ១០. បើក Linux runner និងពិនិត្យ Online

**កន្លែងរត់៖ Ubuntu ក្នុង `tools/actions-runners`។**

```bash
docker compose up -d
docker compose ps
docker compose logs --tail=50
```

`-d` ឱ្យ containers រត់នៅ background។ ក្នុង `docker compose ps` ត្រូវមាន services ទាំង ៤ Up/Running។ ក្នុង logs គួរឃើញ Connected to GitHub និង Listening for Jobs។

បើក GitHub → Settings → Actions → Runners ពិនិត្យ៖

| Runner name | Labels ចាំបាច់ | ស្ថានភាពពេលទំនេរ |
|---|---|---|
| `Zoe-WSL-Audit-1` | self-hosted, Linux, X64, wsl-zoe-audit | Online / Idle |
| `Zoe-WSL-Audit-2` | self-hosted, Linux, X64, wsl-zoe-audit | Online / Idle |
| `Zoe-WSL-Audit-3` | self-hosted, Linux, X64, wsl-zoe-audit | Online / Idle |
| `Zoe-WSL-Audit-4` | self-hosted, Linux, X64, wsl-zoe-audit | Online / Idle |

ដាក់ labels តាម script ដើម្បីឱ្យ workflow ចាប់ runner ត្រូវ។ Runner ចាស់ដែលមិនប្រើគួរបញ្ឈប់ពេលគ្មាន job ដើម្បីសន្សំ RAM។ បើ native Linux runner ចាស់រត់ជា service ប្រើ `sudo ./svc.sh stop` ពី directory របស់ runner នោះ; បើរត់ `./run.sh` ក្នុង terminal ប្រើ Ctrl+C។

**ចំណុចត្រូវឆ្លង៖** Runner ថ្មីទាំង ៤ Online និងមាន custom label ត្រឹមត្រូវ។

## ១១. ដំឡើងឧបករណ៍សម្រាប់ Windows APK runner

**កន្លែងធ្វើ៖ Windows។** APK runner នេះរត់ Windows ផ្ទាល់ មិនប្រើ WSL។

១. ដំឡើង [Git for Windows](https://git-scm.com/downloads/win) ឱ្យ Git/Git Bash មានក្នុង PATH។

២. ដំឡើង [GitHub CLI សម្រាប់ Windows](https://cli.github.com/)។

៣. បើក PowerShell window ថ្មីក្រោយដំឡើង ដើម្បីទទួល PATH ថ្មី។

**កន្លែងរត់៖ PowerShell។**

```powershell
git --version
gh --version
& 'C:\Program Files\Git\bin\bash.exe' -lc 'command -v cygpath; command -v base64; command -v sha256sum'
```

បើ Git ដំឡើងនៅផ្លូវផ្សេង ត្រូវកែផ្លូវ `bash.exe` ឱ្យត្រូវ។ Command ចុងក្រោយត្រូវបង្ហាញផ្លូវរបស់ឧបករណ៍ទាំង ៣។ Workflow ប្រើ Git Bash សម្រាប់ logic និង PowerShell ដើម្បីហៅ Windows Gradle/apksigner។

ឆែក `bash.exe` ដែល Windows រកឃើញ៖

```powershell
where.exe bash
```

បើបន្ទាត់ដំបូងជា `WindowsApps\bash.exe` វាអាចជ្រើស launcher របស់ WSL ហើយបើក script ផ្លូវ Windows មិនបាន។ APK workflow មាន step «កំណត់ Git Bash របស់ Windows» ដែលរត់ PowerShell មុន ហើយដាក់ folder Git Bash នៅដើម PATH សម្រាប់ job នោះ។ ពេលមើល log របស់ step Bash បន្ទាប់ ត្រូវឃើញ shell ក្នុង folder `Git\bin\bash.exe`។

បើកែ workflow មិនទាន់ចូល `main` អាចដោះស្រាយលើម៉ាស៊ីនសិន៖ Start → វាយ **Edit the system environment variables** → Environment Variables → ក្នុង **System variables** ជ្រើស **Path** → Edit → បន្ថែម `C:\Program Files\Git\bin` ហើយ Move Up ឱ្យនៅមុន entry `WindowsApps` ប្រសិនបើមាន។ កែផ្លូវតាមទីតាំង Git ពិតរបស់អ្នក។ កុំលុប entry WindowsApps; កុំប្រើ `setx PATH` ដែលអាចបាត់ PATH ចាស់។ បើ service ប្រើ user account ដែលមាន user PATH ផ្ទាល់ ត្រូវពិនិត្យ Path របស់ account នោះដែរ។

ក្រោយដំឡើង tools ឬកែ PATH បើក PowerShell ជា Administrator ហើយ restart តែ APK service៖

```powershell
Restart-Service 'actions.runner.mengsroy-h-Zoe-System.Zoe-Windows-APK'
```

បន្ទាប់មក Actions → Android APK → Run workflow → main។ `Re-run jobs` រក្សា workflow/commit ដើម; ក្រោយ merge ការកែ workflow ត្រូវបង្កើត run ថ្មី។

Node, Java និង Android command-line SDK ដំឡើងតាម workflow។ មិនចាំបាច់ដំឡើង Android Studio ដើម្បីប្រើ runner នេះ។ ក្នុង job ការបង្កើត GitHub Release ប្រើ token ដែល workflow ផ្ដល់; មិនត្រូវ login `gh` ដោយដៃសម្រាប់ runner នីមួយៗទេ។

**ចំណុចត្រូវឆ្លង៖** Git, gh និង Git Bash tools ឆ្លើយតបក្នុង Windows។

## ១២. ទាញ និង Register Windows runner ១

**កន្លែងយក installer/token៖ Windows browser → GitHub។**

Settings → Actions → Runners → New self-hosted runner → **Windows → x64**។ ទំព័រនេះមាន download, checksum, extract និង config commands សម្រាប់ Windows។

**កន្លែងរត់៖ PowerShell ជា Administrator សម្រាប់ការដំឡើង service។**

```powershell
New-Item -ItemType Directory -Force C:\actions-runner-apk
Set-Location C:\actions-runner-apk
```

ពីទំព័រ GitHub ចម្លង command download របស់ Windows មករត់ក្នុង folder នេះ។ បន្ទាប់មករត់ checksum command ដែលទំព័របង្ហាញ និង extract command របស់ Windows។ បើ GitHub block មាន `mkdir actions-runner` និង `cd actions-runner` ដែរ៖ folder របស់យើងបានបង្កើតរួចខាងលើ ដូច្នេះចម្លងតែ download/checksum/extract commands ដើម្បីកុំឱ្យបង្កើត folder ជាន់ទៀត។

បើ checksum មិនត្រូវ ត្រូវដោះស្រាយ download មុន extract/config។ បន្ទាប់ពី extract៖

```powershell
Get-ChildItem
```

ត្រូវឃើញ `config.cmd` និង `run.cmd` ក្នុង `C:\actions-runner-apk`។ បើមិនឃើញ ត្រូវចូល folder ដែលបាន extract files ទាំងនោះជាមុន។

Register ជាមួយ token ថ្មីពីទំព័រ Windows៖

```powershell
.\config.cmd --url https://github.com/mengsroy-h/Zoe-System --token YOUR_REGISTRATION_TOKEN --name Zoe-Windows-APK --labels windows-zoe-android
```

ប្ដូរ `YOUR_REGISTRATION_TOKEN` ដោយ registration token ពិត។ Linux runner ៤បាន register ដោយ script រួច; Windows runner នេះធ្វើដាច់ដោយឡែកម្ដង។

| សំណួរពេល config | ត្រូវធ្វើ |
|---|---|
| Runner group | ប្រើ group ដែលមានសិទ្ធិ repo; Enter សម្រាប់ default បើគ្មានតម្រូវការផ្សេង |
| Work folder | Enter សម្រាប់ `_work` |
| Run runner as a service? | `Y` បើចង់រត់ក្រោយ reboot; `N` បើសាកតាម terminal |
| Service account | ប្រើ account ដែលមានសិទ្ធិសរសេរ runner folder និងឃើញ Git/gh ក្នុង PATH |

បើដំឡើងជា service ពិនិត្យ៖

```powershell
Get-Service 'actions.runner.*'
```

Service របស់ runner ត្រូវ Running។ បើបានដំឡើង Git/gh ក្រោយ service ត្រូវ restart service ដើម្បី refresh PATH។

បើជ្រើសមិន install service សាកដោយ៖

```powershell
.\run.cmd
```

ទុក terminal នេះបើក។ កុំបើក `run.cmd` និង service សម្រាប់ runner ដូចគ្នាព្រមគ្នា។ ប្រើ Administrator សម្រាប់ install service ប៉ុណ្ណោះ; មិនចាំបាច់បើក build terminal ជា Administrator ជាប្រចាំ។

**ចំណុចត្រូវឆ្លង៖** GitHub Runners បង្ហាញ `Zoe-Windows-APK` Online/Idle ជាមួយ labels self-hosted, Windows, X64, windows-zoe-android។

## ១៣. ជ្រើស self-hosted ឬ GitHub mode ដោយ variable មួយ

**កន្លែងធ្វើ៖ GitHub browser។**

១. Repo → Settings → Secrets and variables → Actions។

២. ចុច tab **Variables**។

៣. ចុច **New repository variable**។ បើ variable មានរួច ប្រើ Edit។

៤. Name៖ `ZOE_RUNNER_MODE`។

៥. Value៖ `self-hosted` ឬ `github` តាមតារាងខាងក្រោម។ កុំដាក់ quotation marks ជុំវិញ value។

៦. ចុច Add variable / Save។

| Value | Audit | APK | PC ត្រូវបើក? |
|---|---|---|---|
| `self-hosted` | Linux runner របស់អ្នក ៤ | Windows runner របស់អ្នក | ត្រូវបើក |
| `github` | GitHub `ubuntu-latest` ចំនួន ៤ job | GitHub `windows-latest` | មិនចាំបាច់ |

វាត្រូវជា **Repository variable** ក្នុង tab Variables។ Secret, `.env`, Windows environment variable ឬ variable ក្នុង Settings → Environments មិនត្រូវបានអានដោយ selector របស់ workflow នេះទេ។

បើ variable មិនមាន ឬ value ផ្សេង វាជ្រើស self-hosted ជាលំនាំដើម។ ពិនិត្យដោយ CLI ពី terminal ដែលបាន login GitHub រួច៖

```bash
gh variable get ZOE_RUNNER_MODE --repo mengsroy-h/Zoe-System --json name,value
```

លទ្ធផលត្រូវមាន name `ZOE_RUNNER_MODE` និង value ត្រឹមត្រូវ។ បើ not found ពិនិត្យថាបានបង្កើតជា Repository variable នៅ repo ត្រឹមត្រូវ។

GitHub mode រត់បានទាំង Public និង Private; repo Private ត្រូវមាន quota នាទី ឬ billing សម្រាប់ GitHub-hosted។ Self-hosted mode រត់តែ repo Private។ PR ជា Draft មិនមែនជាលក្ខខណ្ឌ skip របស់ workflow នេះទេ; Audit អាចរត់ PR ក្នុង repo ដដែល ប៉ុន្តែមិនរត់ PR ពី fork។

ពេល quota GitHub ត្រឡប់មក កែ value ទៅ `github` ហើយបង្កើត workflow run ថ្មី។ ការប្ដូរមិនធ្វើស្វ័យប្រវត្តិតាម quota និងមិនផ្លាស់ទី job ដែលកំពុងរត់។

**ចំណុចត្រូវឆ្លង៖** អ្នកបាន Save mode ហើយ CLI ឬ GitHub Variables បង្ហាញតម្លៃត្រឹមត្រូវ។

## ១៤. ដាក់ repo Private សម្រាប់ self-hosted

**កន្លែងធ្វើ៖ GitHub browser។**

Repo → Settings → General → Danger Zone → Change repository visibility → Make private។ អនុវត្តការបញ្ជាក់ដែល GitHub ស្នើ។

Self-hosted jobs នឹង skip បើ repo នៅ Public។ ផ្ដល់សិទ្ធិកែ source/workflow តែអ្នកដែលទុកចិត្ត ព្រោះ workflow អនុវត្តកូដលើ PC របស់អ្នក។

Private បិទការទាញ source ពីអ្នកគ្មានសិទ្ធិ ប៉ុន្តែមិនដកច្បាប់ចម្លងដែលគេធ្លាប់ទាញរួចទេ។ GitHub Release ក្នុង repo Private ក៏ទាមទារសិទ្ធិ; បើចែក App ទៅអតិថិជន ចែកតែ signed APK តាមកន្លែងផ្សេង ដោយមិនផ្ដល់សិទ្ធិចូល source repo។

Self-hosted compute មិនប្រើ quota នាទី GitHub-hosted; artifact/cache នៅ GitHub មាន quota ផ្សេង។ Workflow ទាំងពីរបិទ automatic npm cache upload និងរក្សា dependencies cache តាមម៉ាស៊ីនដែលរត់។

**ចំណុចត្រូវឆ្លង៖** សម្រាប់ self-hosted mode repo Private និង runner ទាំង ៥ Online។

## ១៥. សាក Audit

**កន្លែងធ្វើ៖ GitHub → Actions។**

ការកែ workflow ត្រូវមានក្នុង branch ដែលរត់។ ប៊ូតុង Run workflow សម្រាប់ Audit ត្រូវការ `workflow_dispatch` នៅ default branch។ បើ PR មិនទាន់ merge អាចសាក Audit តាម PR ក្នុង repo ដដែល; APK មាន main guard ដូច្នេះត្រូវដាក់ការកែចូល main មុនប្រើ workflow ថ្មីលើ APK។

បើការកែបាន merge ចូល main៖

១. ពិនិត្យ `ZOE_RUNNER_MODE` និងលក្ខខណ្ឌក្នុងជំហានទី ១៣–១៤។

២. ចូល Actions → ជ្រើស **Audit** ខាងឆ្វេង។

៣. ចុច **Run workflow** → Branch ជ្រើស **main** → Run workflow។

៤. បើក run ថ្មីមើល jobs។ ត្រូវមានផ្នែក 1/4, 2/4, 3/4, 4/4; ទាំង ៤អាចចាប់ព្រមគ្នាបើ runner capacity គ្រប់គ្រាន់។

៥. រង់ចាំ jobs ទាំង ៤ចប់។ លទ្ធផលត្រូវបៃតង ហើយ STRICT tests មិន SKIP។

បើរត់នៅ PR ហើយត្រូវការបង្កើត run ថ្មីដោយមិនកែ source អាច Close PR រួច Reopen PR។ Draft អាចទុកដដែល។ បើចង់សាក workflow code ដែលទើបកែ ត្រូវរត់ event លើ commit ថ្មី; rerun របស់ run ចាស់នៅប្រើ commit/ref ដើម។

**ចំណុចត្រូវឆ្លង៖** Audit ទាំង ៤ job ឆ្លង។ ការមាន runner Online តែឯងមិនបញ្ជាក់ audit បានឆ្លងទេ។

## ១៦. សាក Windows APK workflow

**កន្លែងធ្វើ៖ GitHub browser។** រង់ចាំ Audit ចប់មុនសាក APK ដំបូងលើ PC RAM 16GB។

ពិនិត្យ secrets ដើមក្នុង Settings → Secrets and variables → Actions → Secrets៖

| Secret | ខ្លឹមសារ |
|---|---|
| `ZOEW_KEYSTORE_BASE64` | Keystore ដើមជា base64 |
| `ZOEW_KEYSTORE_PASSWORD` | Password របស់ keystore |
| `ZOEW_KEY_ALIAS` | Alias របស់ key ដើម |
| `ZOEW_KEY_PASSWORD` | Password របស់ key |
| `ZOEW_GOOGLE_SERVICES_JSON` | ស្រេចចិត្ត សម្រាប់ FCM |

**រក្សា keystore ដើម** ដើម្បីឱ្យ APK ថ្មីដំឡើងជាន់ App ចាស់បាន។ មើល [Android guide](../ZoeW/docs/ANDROID.md) សម្រាប់ការរៀបចំ signing។

១. Actions → **Android APK**។

២. Run workflow → Branch **main** → Run workflow។

៣. ក្នុង self-hosted mode ត្រូវឃើញ job ចាប់ `Zoe-Windows-APK`; ក្នុង GitHub mode ប្រើ Windows របស់ GitHub។

៤. មើលជំហាន Node, Java, Android SDK, web build, Gradle, certificate verification និង GitHub Release។ SDK setup ទទួលយក Android SDK licenses ដោយស្វ័យប្រវត្តិ។

បើ version មាន Release រួច workflow នឹងរំលង build។ ការរំលងនេះមិនបញ្ជាក់ថា Gradle/signing លើ runner បានរត់ពេញទេ។ កុំឡើង APP_VERSION ទទេដើម្បីសាក; រង់ចាំ release កំណែបន្ទាប់ពិតប្រាកដ។

**ចំណុចត្រូវឆ្លង៖** សម្រាប់ release ថ្មី APK build និង certificate verification ឆ្លង ហើយ signed APK មានក្នុង Release។

## ១៧. របៀបបើក បិទ និងមើល logs ប្រចាំថ្ងៃ

### Linux៖ Ubuntu ក្នុង runner kit folder

```bash
cd ~/src/Zoe-System/tools/actions-runners
docker compose ps
docker compose logs --tail=100 audit-1
```

មើលការប្រើ RAM/CPU៖

```bash
docker stats
```

Ctrl+C បិទការមើល stats។ ពិនិត្យទំហំ Docker៖

```bash
docker system df
```

បញ្ឈប់ runner ពេលគ្មាន job៖

```bash
docker compose stop
```

បើកឡើងវិញ៖

```bash
docker compose up -d
```

កុំប្រើ `docker compose down -v` បើចង់រក្សា registration/cache ព្រោះ `-v` លុប volumes។ Rebuild image ពេលគ្មាន job ហើយរក្សា volumes៖

```bash
docker build -t zoe-actions-runner:local .
docker compose up -d --force-recreate
```

### Update image ពេលមាន Java ក្នុង Dockerfile

១. រង់ចាំឱ្យ jobs ចប់ ឬ Cancel run នៅ GitHub មុនបញ្ឈប់ containers។

២. Update source ដែលមាន Dockerfile និង workflow ថ្មី។ ក្រោយ merge រួច រត់ក្នុង Ubuntu៖

```bash
cd ~/src/Zoe-System
git switch main
git pull --ff-only
cd tools/actions-runners
docker compose stop
docker build -t zoe-actions-runner:local .
```

៣. បើ build ឆ្លង ទើបបង្កើត containers ថ្មីពី image នោះ ដោយរក្សា named volumes៖

```bash
docker compose up -d --force-recreate
docker compose ps
docker compose exec -T audit-1 bash -c 'node --version; java -version; javac -version'
```

ត្រូវឃើញ services ទាំង ៤ Running និង Node 24/Java 21។ Image ថ្មីផ្ទុក runtime នៅក្រៅ runner home volume ដូច្នេះ registration/cache ចាស់នៅដដែល; មិនត្រូវ register ម្ដងទៀត។ បើ source មាននៅ PR តែមិនទាន់ merge អាច build ពី branch របស់ PR មុនបាន; សម្រាប់តេស្ត main ត្រូវ merge workflow ថ្មីមុន ហើយបង្កើត Run workflow ថ្មី។

### ហេតុអ្វីលើកដំបូងយឺត?

ការទាញលើកដំបូង ឬពេលកំណែ dependencies ប្រែ អាចយូរតាមល្បឿន network។ npm, Chromium និង Firebase emulator មាន cache ក្នុង home volume ដាច់ៗរបស់ runner នីមួយៗ។ ពេល download បានជោគជ័យ ហើយ cache នៅដដែល run បន្ទាប់អាចប្រើវាវិញ។ Download ដែល fail មិនស្មើ cache ដែលបានត្រៀមរួចទេ។ Rebuild image ក៏អាចត្រូវទាញ package ថ្មី; មិនមានការធានាពេលវេលា run ទេ។

កុំលុប named volumes ឬប្រើ Docker prune volumes បើចង់រក្សា registration/cache។ `npm ci` នៅតែដំឡើងតាម package-lock សម្រាប់ source នីមួយៗ; ការមាន npm cache មិនមានន័យថារំលងតេស្ត ឬប្រើ node_modules ចាស់ដោយមិនផ្ទៀងទេ។

### Windows៖ PowerShell

```powershell
Get-Service 'actions.runner.*'
```

បើប្រើ terminal mode ត្រូវបើក `run.cmd` ក្នុង Windows runner folder និងទុក terminal បើក។

### ពេល reboot ឬដាក់ PC ឱ្យដេក

- Self-hosted mode ត្រូវការ PC ភ្ញាក់ មានភ្លើង និងអ៊ីនធឺណិត។
- បើក Docker Desktop Start when you sign in និង WSL Integration។ Docker `restart: unless-stopped` ជួយចាប់ containers ពេល Docker engine ឡើង; វាមិនដាស់ PC ឬបើក Docker Desktop ដោយខ្លួនឯងទេ។
- Windows runner ដែល install service អាចចាប់ឡើងក្រោយ reboot; ពិនិត្យ Running និង GitHub Online។
- បើបិទ Linux containers ដោយ `docker compose stop` ត្រូវបើកវិញដោយ `docker compose up -d`។

## ១៨. តារាងដោះស្រាយកំហុស

| អ្វីដែលឃើញ | មូលហេតុដែលត្រូវពិនិត្យ | ជំហានបន្ទាប់ |
|---|---|---|
| `sudo apt-get`: Command not found ក្នុង PowerShell | ប្រើ terminal ខុស | បើក Ubuntu; ត្រឡប់ជំហានទី ១ និង ៥ |
| `Failed opening a web browser` / `xdg-open` | Ubuntu មិនមាន browser launcher | បើក Windows browser → github.com/login/device → បញ្ចូល code; ជំហានទី ៦ |
| `gh`: command not found ក្នុង Ubuntu | GitHub CLI មិនទាន់ដំឡើងក្នុង Linux | `sudo apt-get install -y gh` |
| `docker`: command not found | Ubuntu មិនបាន WSL Integration | បើក Docker Desktop integration សម្រាប់ distro ពិត; ជំហានទី ៤ |
| Cannot connect to Docker daemon | Docker engine មិនឡើង | បើក Docker Desktop រង់ចាំ Server ឆ្លើយតប |
| Dockerfile/register.sh រកមិនឃើញ | Folder ឬ branch ខុស | `pwd`, `git branch --show-current`, `ls tools/actions-runners`; ជំហានទី ៧ |
| Token invalid/expired | Registration token មិនត្រឹមត្រូវ ឬផុតមួយម៉ោង | យក token ថ្មីពី New self-hosted runner តាម OS; ជំហានទី ៩/១២ |
| Runner name already exists | មាន runner ឈ្មោះដដែលនៅ GitHub | ពិនិត្យ runner ដែលមានស្រាប់មុនលុប; script មិនប្រើ --replace ស្វ័យប្រវត្តិ |
| Runner Offline | Container/service មិនរត់ ឬ network បញ្ហា | មើល Compose logs ឬ Windows service និងអ៊ីនធឺណិត |
| Waiting for a runner | Mode, Online, OS/X64 ឬ label មិនត្រូវ | ជំហានទី ១០, ១២ និង ១៣ |
| Audit PR skipped | Public ជាមួយ self-hosted default, variable ខុស ឬ fork PR | ពិនិត្យ Repository variable ជំហានទី ១៣; Draft មិនមែន skip condition |
| Android workflow skipped | Branch មិនមែន main ឬ Public ក្នុង self-hosted mode | ជំហានទី ១៤ និង ១៦ |
| Android build រំលងក្រោយ meta | Version មាន Release រួច | រង់ចាំ release កំណែថ្មីពិត; កុំឡើង version ទទេ |
| Git/gh/cygpath រកមិនឃើញក្នុង APK job | Windows PATH ឬ service PATH ចាស់ | ជំហានទី ១១; restart service ក្រោយដំឡើង tools |
| `/bin/bash: C:...sh: No such file or directory` ក្នុង APK job | Windows ជ្រើស WSL bash ជំនួស Git Bash | ជំហានទី ១១; log ត្រូវប្រើ `Git\bin\bash.exe`; ក្រោយ merge បង្កើត Run workflow ថ្មីលើ main |
| sudo terminal error ក្នុង audit | Self-hosted កំពុងប្រើ workflow/step ចាស់ | Update branch; --with-deps/sudo ត្រូវរត់តែ GitHub mode |
| Linux image មិនទាន់មាន Java 21 | Workflow ថ្មីប្រើ runtime ក្នុង image ប៉ុន្តែ containers នៅប្រើ image ចាស់ | ជំហានទី ១៧៖ rebuild image, recreate ដោយរក្សា volumes និងបង្កើត Run workflow ថ្មី |
| Emulator port ជាន់ | Runner មិននៅ container ដាច់ៗ | ប្រើ compose ដែលផ្ដល់; គ្មាន host network/port publish/Docker socket |
| Exit 137 / PC អស់ RAM | អាចមាន memory kill | ពិនិត្យ logs និង OOMKilled; កាត់ parallel ឬប្រើ GitHub mode |

បើត្រូវពិនិត្យ OOM របស់ Linux runner ឧទាហរណ៍ `audit-1` ពេលគ្មាន job ថ្មីប្ដូរស្ថានភាព៖

```bash
docker inspect --format '{{.State.OOMKilled}}' "$(docker compose ps -aq audit-1)"
```

តម្លៃ `true` បញ្ជាក់ OOM kill ក្នុងស្ថានភាពដែល Docker កត់ត្រា។ `false` មិនបញ្ជាក់ថាម៉ាស៊ីនគ្មាន memory pressure ទេ; ត្រូវមើល logs រួម។

## ១៩. ចំណុចនៅក្រៅ workflow ទាំងពីរនេះ

`backup.yml` នៅប្រើ GitHub-hosted runner និងមិនប្ដូរតាម `ZOE_RUNNER_MODE` ក្នុងការកែនេះទេ។ ដូច្នេះ quota បញ្ហារបស់ backup ត្រូវរៀបចំបន្ថែម។ Artifact/cache quota ក៏ដាច់ពី self-hosted compute។

ការរៀបចំ runners មិនផ្លាស់ប្ដូរ License ឬ signing key របស់ App។ ការដាក់ Private មិនធានាថា APK មិនអាចត្រូវ patch បានទេ; source access និងការផ្ទៀងផ្ទាត់ License ជារឿងដែលត្រូវគិតដាច់តាម architecture របស់ App។

## ប្រភពផ្លូវការ

- [Microsoft៖ ដំឡើង WSL](https://learn.microsoft.com/en-us/windows/wsl/install)
- [Microsoft៖ .wslconfig](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
- [Docker Desktop WSL2](https://docs.docker.com/desktop/features/wsl/)
- [GitHub CLI៖ gh auth login](https://cli.github.com/manual/gh_auth_login)
- [GitHub៖ បន្ថែម self-hosted runner](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)
- [GitHub៖ Repository variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)
- [GitHub CLI៖ gh variable get](https://cli.github.com/manual/gh_variable_get)
- [GitHub៖ រត់ workflow ដោយដៃ](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Android SDK action](https://github.com/android-actions/setup-android)
