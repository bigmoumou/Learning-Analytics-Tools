/* terminal-cmds.js [SKIN] — the long list of commands of the Terminal on the practice Windows PC (round 6, split from terminal.js).
   Loaded by terminal.js when the first Terminal window opens (a <script> tag in the same folder, same ?query), so the desktop does not download it.
   Holds: the object-pipeline cmdlets (Sort / Where / Select / Measure / Group / ForEach / Format-* / Out-* / Select-String), CSV and JSON, the file extras
   (Resolve-Path, Get-FileHash, Compress-Archive, Expand-Archive, tree, cmd /c, where.exe, findstr), the system commands (Get-Date, processes, services,
   systeminfo, Get-Command / Get-Alias / Get-Help, help), the network commands (ipconfig, ping, nslookup, tracert, curl, winget), python and git, and the
   names of real Windows programs that are not simulated. The code is the round-5 code, moved as it was: it reaches the parser, evaluator, renderer and parameter
   binding of terminal.js through LAB.shell.api, and adds its commands to LAB.shell.commands. The last line sets LAB.shell.library = true. */
(function (LAB) {
  'use strict';

  var A = LAB.shell.api;
  /* everything the library takes from terminal.js (parser, evaluator, renderer, parameter binding, the shared tables) */
  var CMDS = A.CMDS, DAY_EN = A.DAY_EN, DYNAMIC = A.DYNAMIC, HOST = A.HOST, PSHash = A.PSHash, PSObj = A.PSObj, SPEC = A.SPEC,
      SPECIAL_VIEWS = A.SPECIAL_VIEWS, T_ARR = A.T_ARR, T_CUSTOM = A.T_CUSTOM, T_STR = A.T_STR, USER = A.USER, blockTruthy = A.blockTruthy,
      commas = A.commas, dH12 = A.dH12, dLongTime = A.dLongTime, dTT = A.dTT, dateParts = A.dateParts, defCmd = A.defCmd, dispCwd = A.dispCwd,
      displayWidth = A.displayWidth, ellipsize = A.ellipsize, errorText = A.errorText, expandPath = A.expandPath,
      failPathNotFound = A.failPathNotFound, fileDir = A.fileDir, fileNamesFor = A.fileNamesFor, fileProps = A.fileProps,
      flattenForRender = A.flattenForRender, formatDate = A.formatDate, genericTable = A.genericTable, getMember = A.getMember, hasOwn = A.hasOwn,
      hasWild = A.hasWild, hasWildChars = A.hasWildChars, invokeBlock = A.invokeBlock, isBlock = A.isBlock, isDate = A.isDate,
      isFileObj = A.isFileObj, isHash = A.isHash, isHiddenItem = A.isHiddenItem, isObj = A.isObj, isTrash = A.isTrash, joinDisp = A.joinDisp,
      listText = A.listText, makeCmpTest = A.makeCmpTest, mapVfs = A.mapVfs, mkDate = A.mkDate, mkObj = A.mkObj, namedCol = A.namedCol,
      netRegex = A.netRegex, ntfsCmp = A.ntfsCmp, numStr = A.numStr, padL = A.padL, padR = A.padR, parentDisp = A.parentDisp,
      parseDateStr = A.parseDateStr, pathArgs = A.pathArgs, propNames = A.propNames, psCompare = A.psCompare, psEquals = A.psEquals, reEsc = A.reEsc,
      rebuildCompleteNames = A.rebuildCompleteNames, relPathText = A.relPathText, renderObjs = A.renderObjs, resolvePath = A.resolvePath,
      roundEven = A.roundEven, rtrim = A.rtrim, setVar = A.setVar, shortType = A.shortType, splitSegs = A.splitSegs, strCmp = A.strCmp,
      strOf = A.strOf, sw = A.sw, tableLinesOf = A.tableLinesOf, termState = A.termState, toBool = A.toBool, toNum = A.toNum, two = A.two,
      typeNameOf = A.typeNameOf, ufmtDate = A.ufmtDate, unroll = A.unroll, unwrapOut = A.unwrapOut, val = A.val, wildRegex = A.wildRegex,
      winOfSegs = A.winOfSegs;

  /* ---- help */
  var HELP_TEXT = [
    '',
    '練習用的 PowerShell 可以用這些指令（大小寫都可以）：',
    '',
    '  看和走        ls (dir)、cd、pwd、tree、tree /f',
    '  檔案          mkdir、mv、cp、rm、cat、New-Item、Set-Content、Add-Content、Rename-Item、Test-Path',
    '  壓縮          tar -xvf <壓縮檔>、Compress-Archive、Expand-Archive',
    '  管線          ls | Sort-Object Length、Where-Object { $_.Length -gt 1000 }、Select-Object、',
    '                Measure-Object、Group-Object、ForEach-Object',
    '  表格和檔案    Format-Table、Format-List、Out-File、Select-String、Import-Csv、Export-Csv、ConvertTo-Json',
    '  變數和算式    $a = 3、1+2*3、"Hi $env:USERNAME"、$PSVersionTable',
    '  系統          Get-Date、Get-Process、Stop-Process、Get-Service、Get-ComputerInfo、systeminfo、hostname、whoami',
    '  網路          ipconfig、ping、Test-Connection、nslookup、tracert、curl、Invoke-RestMethod',
    '  打開          explorer .、code .、notepad <檔案>、Start-Process（記事本、網址…）',
    '  套件          winget install Git.Git、winget install Python.Python.3.12',
    '  說明          Get-Help <指令> [-Examples]、Get-Command、Get-Alias、history、cls、exit',
    '',
    '打指令之前，輸入法要切成英文（按一下 Shift，工作列的 中 會變成 英）。',
    'Tab 可以補完指令、參數和檔名；Ctrl+C 可以中斷正在跑的指令。',
    ''
  ].join('\n') + '\n';
  var HELP_ONE = {
    'get-childitem': 'ls（dir）：列出資料夾裡的東西。-Force 連隱藏的也列出，-Recurse 連裡面的資料夾也列出。',
    'set-location': 'cd：走到另一個資料夾。cd .. 往外一層，cd ~ 回到家，路徑有空格要加引號：cd "Saved Games"。',
    'get-location': 'pwd：顯示現在所在的資料夾。',
    'mkdir': 'mkdir：建立新資料夾，並列出它。',
    'move-item': 'mv：搬移東西。mv 東西 資料夾 是搬進去；目的地不存在時，會直接改名。',
    'copy-item': 'cp：複製東西。複製資料夾要加 -Recurse。',
    'remove-item': 'rm：刪除東西。沒有資源回收筒，刪了就沒了；資料夾要加 -Recurse。',
    'get-content': 'cat：顯示檔案的內容。',
    'tar': 'tar：-x 解開、-v 把每個檔案列出來、-f 指定檔案。tar -xvf week3.zip',
    'explorer': 'explorer .：用檔案總管打開這個資料夾。'
  };
  function cmdHelp(ctx) {
    var args = ctx.rawArgs.map(String), a = args.filter(function (x) { return x.charAt(0) !== '-'; })[0];
    if (!a) { ctx.out(HELP_TEXT); return 0; }
    var p = { Name: a };
    args.forEach(function (x) { if (/^-ex/i.test(x)) p.Examples = true; if (/^-on/i.test(x)) p.Online = true; });
    ctx.p = p;
    return cmdGetHelp(ctx);
  }

  /* ---- Expand-Archive (bonus) */
  function cmdExpand(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p;
    var arg = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.Path;
    var zr = resolvePath(s, arg);
    var zst = zr.err ? null : vfs.stat(zr.abs);
    if (!zst || zst.type === 'dir') {
      return ctx.fail({ msg: "路徑 '" + arg + "' 不存在或不是有效的檔案系統路徑。", cat: 'InvalidArgument', target: arg, activity: 'Expand-Archive', reason: 'InvalidOperationException', fq: 'ArchiveCmdletPathNotFound,Expand-Archive' });
    }
    var ext = vfs.extname(zst.name).toLowerCase();
    if (ext !== '.zip') {
      return ctx.fail({ msg: ext + ' 不是支援的保存檔案格式。.zip 是唯一支援的保存檔案格式。', cat: 'InvalidArgument', target: ext, activity: 'Expand-Archive', reason: 'IOException', fq: 'NotSupportedArchiveFileExtension,Expand-Archive' });
    }
    var entries = zst.kind === 'zip' ? vfs.zipEntries(zst.path) : null;
    if (!entries) {
      // the real text (the module path and the clipped source line are constants of Windows PowerShell 5.1)
      ctx.err('New-Object : 以 "3" 引數呼叫 ".ctor" 時發生例外狀況: "中央目錄損毀。"\n' +
        '位於 C:\\WINDOWS\\system32\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.Archive\\Microsoft.PowerShell.Archive.psm1:1014 字元:23\n' +
        '+ ... ipArchive = New-Object -TypeName System.IO.Compression.ZipArchive -Ar ...\n' +
        '+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n' +
        '    + CategoryInfo          : InvalidOperation: (:) [New-Object]，MethodInvocationException\n' +
        '    + FullyQualifiedErrorId : ConstructorInvokedThrowException,Microsoft.PowerShell.Commands.NewObjectCommand\n\n');
      return 1;
    }
    if (P.DestinationPath === undefined || P.DestinationPath === null) {
      // real PowerShell asks 「DestinationPath:」 here; the practice PC reports the missing parameter instead
      return ctx.fail({ msg: '無法處理命令，因為至少遺失了一個必要參數:  DestinationPath。', cat: 'InvalidArgument', target: '', activity: 'Expand-Archive', reason: 'ParameterBindingException', fq: 'MissingMandatoryParameter,Expand-Archive' });
    }
    var dr = resolvePath(s, P.DestinationPath);
    if (dr.err) return failPathNotFound(ctx, { kind: dr.err, disp: dr.disp, drive: dr.drive });
    if (!P.Force) {
      var clash = entries.filter(function (en) { return en.type === 'file' && vfs.exists(vfs.join(dr.abs, en.name)); })[0];
      if (clash) {
        var cd = joinDisp(dr.disp, clash.name.replace(/\//g, '\\')), zd = zr.disp;
        ctx.err(PSMSG_EXPAND(zd, cd));
        return 1;
      }
    }
    try { vfs.extractZip(zst.path, dr.abs, { by: 'terminal' }); } catch (e) { return mapVfs(ctx, e, dr.disp, 'Expand-Archive'); }
    return 0;
  }
  /* the real (long) text of Expand-Archive when a file already exists; the module path is a constant of Windows PowerShell 5.1 */
  function PSMSG_EXPAND(zipDisp, fileDisp) {
    var cols = 120;
    var msg = 'ExpandArchiveHelper : 擴充保存檔案 \'' + zipDisp + '\' 內容時無法建立檔案 \'' + fileDisp + '\'，因為檔案 \'' + fileDisp + '\' 已經存在。如果您想要在擴充保存檔案時覆寫現有的目錄 \'' + fileDisp + '\' 內容，請使用 -Force 參數。';
    return msg + '\n位於 C:\\WINDOWS\\system32\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.Archive\\Microsoft.PowerShell.Archive.psm1:407 字元:17\n' +
      '+ ...             ExpandArchiveHelper $resolvedSourcePaths $resolvedDestina ...\n' +
      '+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n' +
      '    + CategoryInfo          : InvalidOperation: (' + ellipsize(fileDisp) + ':String) [Write-Error]，IOException\n' +
      '    + FullyQualifiedErrorId : ExpandArchiveFileExists,ExpandArchiveHelper\n\n';
  }
  defCmd({ id: 'help', canon: 'help', native: true, name: 'help', run: cmdHelp }, ['help', 'man', 'Get-Help']);
  defCmd({ id: 'expand', canon: 'unknown', spec: SPEC.expand, run: cmdExpand }, ['Expand-Archive']);

  /* ====================================================================================================================
     Round 5 — the object-pipeline cmdlets: Sort / Where / Select / Measure / Group / ForEach / Format-* / Out-* / Select-String / CSV / JSON.
     Every cmdlet reads ctx.input (the objects of the previous stage, or its own -InputObject) and ctx.emit()s objects; the last stage is
     rendered by renderObjs (Out-Default). Parameter tables follow the real cmdlets of Windows PowerShell 5.1 closely enough for -Abbreviations.
     ==================================================================================================================== */
  var T_OBJ = 'System.Object';
  var OP_PARAMS = ['EQ', 'CEQ', 'NE', 'CNE', 'GT', 'CGT', 'LT', 'CLT', 'GE', 'CGE', 'LE', 'CLE', 'Like', 'CLike', 'NotLike', 'CNotLike', 'Match', 'CMatch', 'NotMatch', 'CNotMatch', 'Contains', 'CContains', 'NotContains', 'CNotContains', 'In', 'CIn', 'NotIn', 'CNotIn', 'Is', 'IsNot'];
  var CORE = 'Microsoft.PowerShell.Commands.';
  SPEC.sort = { name: 'Sort-Object', cls: CORE + 'SortObjectCommand', params: [val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }), sw('Descending'), sw('Unique'), val('InputObject', { raw: true, type: T_OBJ, pipe: true }),
    val('Culture', { type: T_STR }), sw('CaseSensitive')] };
  SPEC.where = { name: 'Where-Object', cls: CORE + 'WhereObjectCommand', params: [val('FilterScript', { pos: 0, raw: true, type: 'System.Management.Automation.ScriptBlock' }), val('Property', { raw: true, type: T_STR }),
    val('Value', { pos: 1, raw: true, type: T_OBJ }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })].concat(OP_PARAMS.map(function (n) { return val(n, { raw: true, type: T_OBJ }); })) };
  SPEC.select = { name: 'Select-Object', cls: CORE + 'SelectObjectCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }),
    val('ExcludeProperty', { arr: true, type: T_ARR }), val('ExpandProperty', { type: T_STR }), sw('Unique'), val('Last', { type: 'System.Int32' }), val('First', { type: 'System.Int32' }), val('Skip', { type: 'System.Int32' }),
    val('SkipLast', { type: 'System.Int32' }), sw('Wait'), val('Index', { arr: true, type: 'System.Int32[]' })] };
  SPEC.measure = { name: 'Measure-Object', cls: CORE + 'MeasureObjectCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Property', { pos: 0, arr: true, type: T_ARR }),
    sw('Sum'), sw('Average'), sw('Maximum'), sw('Minimum'), sw('Line'), sw('Word'), sw('Character'), sw('IgnoreWhiteSpace'), sw('AllStats')] };
  SPEC.group = { name: 'Group-Object', cls: CORE + 'GroupObjectCommand', params: [val('NoElement', { type: 'System.Boolean' }), val('AsHashTable', { type: 'System.Boolean' }), sw('AsString'),
    val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }), val('Culture', { type: T_STR }), sw('CaseSensitive')] };
  SPEC.group.params[0] = sw('NoElement'); SPEC.group.params[1] = sw('AsHashTable');
  SPEC.foreach = { name: 'ForEach-Object', cls: CORE + 'ForEachObjectCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Begin', { raw: true, type: 'System.Management.Automation.ScriptBlock' }),
    val('Process', { pos: 0, arr: true, raw: true, type: 'System.Management.Automation.ScriptBlock[]' }), val('End', { raw: true, type: 'System.Management.Automation.ScriptBlock' }),
    val('RemainingScripts', { arr: true, raw: true, type: 'System.Management.Automation.ScriptBlock[]' }), val('MemberName', { type: T_STR }), val('ArgumentList', { arr: true, raw: true, type: T_ARR, al: ['Args'] })] };
  SPEC.ft = { name: 'Format-Table', cls: CORE + 'FormatTableCommand', params: [sw('AutoSize'), sw('HideTableHeaders'), sw('Wrap'), val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }), val('GroupBy', { raw: true, type: T_OBJ }),
    val('View', { type: T_STR }), sw('ShowError'), sw('DisplayError'), sw('Force'), val('Expand', { type: T_STR }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.fl = { name: 'Format-List', cls: CORE + 'FormatListCommand', params: [val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }), val('GroupBy', { raw: true, type: T_OBJ }), val('View', { type: T_STR }),
    sw('ShowError'), sw('DisplayError'), sw('Force'), val('Expand', { type: T_STR }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.fw = { name: 'Format-Wide', cls: CORE + 'FormatWideCommand', params: [val('Property', { pos: 0, raw: true, type: T_OBJ }), sw('AutoSize'), val('Column', { type: 'System.Int32' }), val('GroupBy', { raw: true, type: T_OBJ }),
    val('View', { type: T_STR }), sw('ShowError'), sw('DisplayError'), sw('Force'), val('Expand', { type: T_STR }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.outfile = { name: 'Out-File', cls: CORE + 'OutFileCommand', risk: true, params: [val('FilePath', { pos: 0, mand: true, type: T_STR, al: ['Path'] }), val('LiteralPath', { type: T_STR, al: ['PSPath'] }), val('Encoding', { pos: 1, type: T_STR }),
    sw('Append'), sw('Force'), sw('NoClobber', ['NoOverwrite']), val('Width', { type: 'System.Int32' }), sw('NoNewline'), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.outstring = { name: 'Out-String', cls: CORE + 'OutStringCommand', params: [sw('Stream'), val('Width', { type: 'System.Int32' }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.outhost = { name: 'Out-Host', cls: CORE + 'OutHostCommand', params: [sw('Paging'), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.outnull = { name: 'Out-Null', cls: CORE + 'OutNullCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.sls = { name: 'Select-String', cls: CORE + 'SelectStringCommand', params: [val('Pattern', { pos: 0, arr: true, type: T_ARR, mand: true }), val('Path', { pos: 1, arr: true, type: T_ARR }), val('LiteralPath', { arr: true, type: T_ARR }),
    val('InputObject', { raw: true, type: T_OBJ, pipe: true }), sw('SimpleMatch'), sw('CaseSensitive'), sw('Quiet'), sw('List'), val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), sw('NotMatch'),
    sw('AllMatches'), val('Encoding', { type: T_STR }), val('Context', { arr: true, type: 'System.Int32[]' })] };
  SPEC.ipcsv = { name: 'Import-Csv', cls: CORE + 'ImportCsvCommand', params: [val('Delimiter', { pos: 1, type: 'System.Char' }), val('Path', { pos: 0, arr: true, type: T_ARR, pipe: true, mand: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }),
    sw('UseCulture'), val('Header', { arr: true, type: T_ARR }), val('Encoding', { type: T_STR })] };
  SPEC.epcsv = { name: 'Export-Csv', cls: CORE + 'ExportCsvCommand', risk: true, params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Path', { pos: 0, type: T_STR }), val('LiteralPath', { type: T_STR, al: ['PSPath'] }),
    sw('Force'), sw('NoClobber'), val('Encoding', { type: T_STR }), sw('Append'), val('Delimiter', { pos: 1, type: 'System.Char' }), sw('UseCulture'), sw('NoTypeInformation')] };
  SPEC.tocsv = { name: 'ConvertTo-Csv', cls: CORE + 'ConvertToCsvCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Delimiter', { pos: 1, type: 'System.Char' }), sw('UseCulture'), sw('NoTypeInformation')] };
  SPEC.fromcsv = { name: 'ConvertFrom-Csv', cls: CORE + 'ConvertFromCsvCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Delimiter', { pos: 1, type: 'System.Char' }), sw('UseCulture'), val('Header', { arr: true, type: T_ARR })] };
  SPEC.tojson = { name: 'ConvertTo-Json', cls: CORE + 'ConvertToJsonCommand', params: [val('InputObject', { pos: 0, raw: true, type: T_OBJ, pipe: true }), val('Depth', { type: 'System.Int32' }), sw('Compress')] };
  SPEC.fromjson = { name: 'ConvertFrom-Json', cls: CORE + 'ConvertFromJsonCommand', params: [val('InputObject', { pos: 0, raw: true, type: T_OBJ, pipe: true, mand: true })] };
  SPEC.tee = { name: 'Tee-Object', cls: CORE + 'TeeObjectCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('FilePath', { pos: 0, type: T_STR, al: ['Path'] }), val('LiteralPath', { type: T_STR }), sw('Append'), val('Variable', { type: T_STR })] };
  SPEC.gm = { name: 'Get-Member', cls: CORE + 'GetMemberCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Name', { pos: 0, arr: true, type: T_ARR }), val('MemberType', { type: T_STR }), val('View', { type: T_STR }), sw('Static'), sw('Force')] };
  SPEC.unique = { name: 'Get-Unique', cls: CORE + 'GetUniqueCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), sw('AsString'), sw('OnType')] };
  SPEC.random = { name: 'Get-Random', cls: CORE + 'GetRandomCommand', params: [val('Maximum', { pos: 0, raw: true, type: T_OBJ }), val('Minimum', { pos: 1, raw: true, type: T_OBJ }), val('InputObject', { raw: true, type: T_OBJ, pipe: true }),
    val('Count', { type: 'System.Int32' }), val('SetSeed', { type: 'System.Int32' })] };
  SPEC.writewarn = { name: 'Write-Warning', cls: CORE + 'WriteWarningCommand', params: [val('Message', { pos: 0, mand: true, type: T_STR, al: ['Msg'] })] };
  SPEC.writeerr = { name: 'Write-Error', cls: CORE + 'WriteErrorCommand', params: [val('Message', { pos: 0, mand: true, type: T_STR, al: ['Msg'] }), val('Category', { type: T_STR }), val('ErrorId', { type: T_STR }), val('TargetObject', { raw: true, type: T_OBJ })] };
  SPEC.readhost = { name: 'Read-Host', cls: CORE + 'ReadHostCommand', params: [val('Prompt', { pos: 0, raw: true, type: T_OBJ }), sw('AsSecureString')] };
  SPEC.setalias = { name: 'Set-Alias', cls: CORE + 'SetAliasCommand', params: [val('Name', { pos: 0, mand: true, type: T_STR }), val('Value', { pos: 1, mand: true, type: T_STR }), val('Description', { type: T_STR }), val('Option', { type: T_STR }), sw('PassThru'), val('Scope', { type: T_STR }), sw('Force')] };
  SPEC.clip = { name: 'Set-Clipboard', cls: CORE + 'SetClipboardCommand', params: [val('Value', { pos: 0, arr: true, raw: true, type: T_ARR, pipe: true }), sw('Append'), sw('AsHtml')] };
  SPEC.getclip = { name: 'Get-Clipboard', cls: CORE + 'GetClipboardCommand', params: [sw('Raw'), val('Format', { type: T_STR })] };

  function inputItems(ctx) {
    var P = ctx.p || {};
    if (ctx.hasInput) return ctx.input;
    if (P.InputObject !== undefined && P.InputObject !== null) return unroll(P.InputObject);
    return [];
  }
  function S_(ctx) { return ctx.session; }
  function evalSpecValue(spec, item, S) {
    if (isBlock(spec)) return unwrapOut(invokeBlock(spec, S, item));
    return getMember(item, strOf(spec), S);
  }
  /* a calculated property: @{Name='x'; Expression={...}} (n / l / label and e / expression are accepted) */
  function hashCol(h, S) {
    var lab = null, ex = null;
    ['Name', 'Label', 'n', 'l'].forEach(function (k) { if (lab === null && h.has(k)) lab = strOf(h.get(k)); });
    ['Expression', 'e'].forEach(function (k) { if (ex === null && h.has(k)) ex = h.get(k); });
    if (ex === null) return null;
    var width = h.has('Width') ? toNum(h.get('Width')) : null;
    if (lab === null) lab = isBlock(ex) ? ex.src.trim() : strOf(ex);
    return { h: lab, fn: function (it) { return evalSpecValue(ex, it, S); }, calc: true, ex: ex };
  }
  /* property specs (names, wildcards, blocks, hashtables) -> column descriptors, wildcards expanded against the items */
  function specCols(specs, items, S) {
    var cols = [];
    unroll(specs).forEach(function (sp) {
      if (isHash(sp)) { var hc = hashCol(sp, S); if (hc) cols.push(hc); return; }
      if (isBlock(sp)) { cols.push({ h: sp.src.trim(), fn: function (it) { return evalSpecValue(sp, it, S); } }); return; }
      var nm = strOf(sp);
      if (hasWildChars(nm)) {
        var re = wildRegex(nm), seen = {};
        items.forEach(function (it) { propNames(it).forEach(function (pn) { var lc = pn.toLowerCase(); if (re.test(pn) && !seen[lc]) { seen[lc] = 1; cols.push(namedCol(pn)); } }); });
        return;
      }
      // the label keeps the spelling of the property when the object has it
      var label = nm;
      for (var i = 0; i < items.length; i++) { var pn2 = propNames(items[i]).filter(function (x) { return x.toLowerCase() === nm.toLowerCase(); })[0]; if (pn2) { label = pn2; break; } }
      cols.push(namedCol(label));
    });
    return cols;
  }
  function selectedType(it) { return 'Selected.' + (typeNameOf(it) || T_OBJ); }

  /* ---- Sort-Object */
  function cmdSort(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx).slice();
    var cs = !!P.CaseSensitive, desc = !!P.Descending;
    var keys = [];
    unroll(P.Property === undefined ? [] : P.Property).forEach(function (sp) {
      if (isHash(sp)) {
        var ex = sp.has('Expression') ? sp.get('Expression') : (sp.has('e') ? sp.get('e') : null);
        var d = sp.has('Descending') ? toBool(sp.get('Descending')) : (sp.has('Ascending') ? !toBool(sp.get('Ascending')) : null);
        if (ex !== null) keys.push({ get: function (it) { return evalSpecValue(ex, it, S); }, desc: d });
        return;
      }
      if (isBlock(sp)) { keys.push({ get: function (it) { return evalSpecValue(sp, it, S); }, desc: null }); return; }
      var nm = strOf(sp);
      if (hasWildChars(nm)) { items.length && propNames(items[0]).filter(function (x) { return wildRegex(nm).test(x); }).forEach(function (x) { keys.push({ get: function (it) { return getMember(it, x, S); }, desc: null }); }); return; }
      keys.push({ get: function (it) { return getMember(it, nm, S); }, desc: null });
    });
    var dec = items.map(function (it, i) { return { it: it, i: i, k: keys.length ? keys.map(function (k) { return k.get(it); }) : [it] }; });
    dec.sort(function (a, b) {
      for (var j = 0; j < a.k.length; j++) {
        var c = psCompare(a.k[j], b.k[j], cs);
        if (c) { var dj = keys.length && keys[j].desc !== null ? keys[j].desc : desc; return dj ? -c : c; }
      }
      return a.i - b.i;
    });
    var out = dec;
    if (P.Unique) {
      out = [];
      dec.forEach(function (d) { var last = out[out.length - 1]; if (last && last.k.every(function (kv, j) { return psEquals(kv, d.k[j], cs); })) return; out.push(d); });
    }
    ctx.emit(out.map(function (d) { return d.it; }));
    return 0;
  }

  /* ---- Where-Object */
  function cmdWhere(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx);
    var fs = P.FilterScript;
    if (isBlock(fs)) {
      items.forEach(function (it) { if (blockTruthy(invokeBlock(fs, S, it))) ctx.emitOne(it); });
      return 0;
    }
    var prop = P.Property !== undefined ? strOf(P.Property) : (fs === undefined ? null : strOf(fs));
    if (prop === null) return 0;
    var op = null, rv = null, cs = false;
    for (var i = 0; i < OP_PARAMS.length; i++) {
      var n = OP_PARAMS[i];
      if (hasOwn.call(P, n)) { op = n; rv = P[n] === true ? P.Value : P[n]; break; }
    }
    items.forEach(function (it) {
      var lv = getMember(it, prop, S);
      if (op === null) { if (toBool(lv)) ctx.emitOne(it); return; }
      var o = op.toLowerCase(); cs = false;
      if (o.charAt(0) === 'c' && o !== 'contains' && o !== 'cnotcontains' && o !== 'cin' || /^c(contains|notcontains|in|notin)$/.test(o)) { cs = true; o = o.slice(1); }
      if (o === 'isnot' || o === 'is') rv = { pstype: { name: strOf(rv).replace(/^\[|\]$/g, '') } };
      var test = makeCmpTest(o, rv, cs, S, false);
      if (test && test(lv)) ctx.emitOne(it);
    });
    return 0;
  }

  /* ---- Select-Object */
  function cmdSelect(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx).slice(), status = 0;
    if (P.Skip !== undefined) items = items.slice(Math.max(0, Number(P.Skip)));
    if (P.SkipLast !== undefined) items = items.slice(0, Math.max(0, items.length - Number(P.SkipLast)));
    if (P.First !== undefined) items = items.slice(0, Math.max(0, Number(P.First)));
    if (P.Last !== undefined) items = items.slice(Math.max(0, items.length - Number(P.Last)));
    if (P.Index) { var ix = P.Index.map(Number); items = items.filter(function (x, i) { return ix.indexOf(i) >= 0; }); }
    if (P.ExpandProperty !== undefined) {
      var pn = String(P.ExpandProperty);
      items.forEach(function (it) {
        var has = isObj(it) ? (it.file ? fileNamesFor(it).some(function (x) { return x.toLowerCase() === pn.toLowerCase(); }) : !!it.find(pn)) : (isHash(it) ? it.has(pn) : propNames(it).some(function (x) { return x.toLowerCase() === pn.toLowerCase(); }));
        var v = getMember(it, pn, S);
        if (!has || (v === null && !has)) {
          status = 1;
          ctx.fail({ msg: '找不到 "' + pn + '" 屬性。', cat: 'InvalidArgument', target: strOf(it), ttype: 'PSObject', activity: 'Select-Object', reason: 'PSArgumentException', fq: 'ExpandPropertyNotFound,' + CORE + 'SelectObjectCommand', head: 'Select-Object', start: ctx.cmd.start, len: ctx.cmd.end - ctx.cmd.start });
          return;
        }
        if (Array.isArray(v)) v.forEach(function (x) { ctx.emitOne(x); }); else ctx.emitOne(v);
      });
      return status;
    }
    if (P.Property === undefined) {
      if (P.Unique) { var seenU = []; items = items.filter(function (it) { var k = strOf(it); if (seenU.indexOf(k) >= 0) return false; seenU.push(k); return true; }); }
      ctx.emit(items);
      return 0;
    }
    var cols = specCols(P.Property, items, S);
    var excl = (P.ExcludeProperty || []).map(function (x) { return String(x).toLowerCase(); });
    cols = cols.filter(function (c) { return excl.indexOf(c.h.toLowerCase()) < 0; });
    var outs = items.map(function (it) {
      var o = new PSObj(selectedType(it), cols.map(function (c) { return [c.h, c.fn(it)]; }), { custom: true });
      return o;
    });
    if (P.Unique) { var seen = []; outs = outs.filter(function (o) { var k = o.p.map(function (e) { return strOf(e.v); }).join('\u0001'); if (seen.indexOf(k) >= 0) return false; seen.push(k); return true; }); }
    ctx.emit(outs);
    return 0;
  }

  /* ---- Measure-Object */
  function cmdMeasure(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx), status = 0;
    var text = P.Line || P.Word || P.Character;
    if (text) {
      var lines = 0, words = 0, chars = 0;
      items.forEach(function (it) {
        var s = strOf(it);
        s.replace(/\r\n/g, '\n').split('\n').forEach(function (ln, i, arr) {
          if (i === arr.length - 1 && ln === '' && arr.length > 1) return;
          if (P.IgnoreWhiteSpace && ln.trim() === '') return;
          lines++;
          var w = ln.trim() === '' ? [] : ln.trim().split(/\s+/);
          words += w.length;
          chars += P.IgnoreWhiteSpace ? ln.replace(/\s/g, '').length : ln.length;
        });
      });
      ctx.emitOne(new PSObj('Microsoft.PowerShell.Commands.TextMeasureInfo', [['Lines', P.Line ? lines : null], ['Words', P.Word ? words : null], ['Characters', P.Character ? chars : null], ['Property', null]]));
      return 0;
    }
    var props = P.Property || [null];
    props.forEach(function (pn) {
      var vals = [], count = 0;
      items.forEach(function (it) {
        var v = pn === null ? it : getMember(it, pn, S);
        if (pn !== null && (v === null || v === undefined)) return;
        count++;
        vals.push(v);
      });
      var wantSum = P.Sum || P.AllStats, wantAvg = P.Average || P.AllStats, wantMax = P.Maximum || P.AllStats, wantMin = P.Minimum || P.AllStats;
      var res = { Count: count, Average: null, Sum: null, Maximum: null, Minimum: null };
      if (wantSum || wantAvg || wantMax || wantMin) {
        var nums = [], bad = null;
        vals.forEach(function (v) { var n = typeof v === 'number' ? v : (typeof v === 'string' || typeof v === 'boolean' ? toNum(v) : (isDate(v) ? v.ms : null)); if (n === null) { if (bad === null) bad = v; } else nums.push(n); });
        if (bad !== null && (wantSum || wantAvg)) {
          status = 1;
          ctx.fail({ msg: '輸入物件 "' + strOf(bad) + '" 不是數值。', cat: 'InvalidType', target: strOf(bad), ttype: typeNameOf(bad) ? shortType(typeNameOf(bad)) : 'String', activity: 'Measure-Object', reason: 'PSInvalidOperationException', fq: 'NonNumericInputObject,' + CORE + 'MeasureObjectCommand', head: 'Measure-Object', start: ctx.cmd.start, len: ctx.cmd.end - ctx.cmd.start });
        }
        var sum = nums.reduce(function (a, b) { return a + b; }, 0);
        if (wantSum && nums.length) res.Sum = sum;
        if (wantAvg && nums.length) res.Average = sum / nums.length;
        if (wantMax && vals.length) res.Maximum = nums.length ? Math.max.apply(null, nums) : vals.slice().sort(function (a, b) { return psCompare(b, a); })[0];
        if (wantMin && vals.length) res.Minimum = nums.length ? Math.min.apply(null, nums) : vals.slice().sort(function (a, b) { return psCompare(a, b); })[0];
      }
      ctx.emitOne(new PSObj('Microsoft.PowerShell.Commands.GenericMeasureInfo', [['Count', res.Count], ['Average', res.Average], ['Sum', res.Sum], ['Maximum', res.Maximum], ['Minimum', res.Minimum], ['Property', pn]]));
    });
    return status;
  }

  /* ---- Group-Object */
  function cmdGroup(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx);
    var specs = P.Property === undefined ? [] : unroll(P.Property);
    var cs = !!P.CaseSensitive, order = [], map = Object.create(null);
    items.forEach(function (it) {
      var key = specs.length ? specs.map(function (sp) { return strOf(evalSpecValue(isHash(sp) ? (sp.get('Expression') || sp.get('e')) : sp, it, S)); }).join(', ') : strOf(it);
      var k = cs ? key : key.toLowerCase();
      if (!map[k]) { map[k] = { name: key, items: [] }; order.push(k); }
      map[k].items.push(it);
    });
    if (P.AsHashTable) {
      var h = new PSHash(null);
      order.forEach(function (k) { h.set(map[k].name, P.AsString || true ? (map[k].items.length === 1 ? map[k].items[0] : map[k].items) : map[k].items); });
      ctx.emitOne(h);
      return 0;
    }
    order.forEach(function (k) {
      var g = map[k];
      var o = new PSObj('Microsoft.PowerShell.Commands.GroupInfo', [['Count', g.items.length], ['Name', g.name], ['Group', P.NoElement ? null : g.items]], { fmt: 'group', noElement: !!P.NoElement });
      ctx.emitOne(o);
    });
    return 0;
  }

  /* ---- ForEach-Object */
  function cmdForEach(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx), status = 0;
    var procs = P.Process === undefined ? [] : unroll(P.Process);
    if (P.MemberName !== undefined) procs = [P.MemberName];
    var begin = P.Begin, end = P.End, blocks = procs.filter(isBlock);
    if (blocks.length === 0 && procs.length && !isBlock(procs[0])) {
      // ForEach-Object Name  /  -MemberName Name
      var mn = strOf(procs[0]);
      items.forEach(function (it) { var v = getMember(it, mn, S); if (v !== null && v !== undefined) ctx.emit(v); });
      return 0;
    }
    if (isBlock(begin)) ctx.emit(invokeBlock(begin, S, null));
    var proc = blocks.length ? blocks[0] : null;
    if (blocks.length > 1 && !isBlock(end)) { end = blocks[blocks.length - 1]; }
    items.forEach(function (it) { if (proc) ctx.emit(invokeBlock(proc, S, it)); });
    if (isBlock(end)) ctx.emit(invokeBlock(end, S, null));
    return status;
  }

  /* ---- Format-Table / Format-List / Format-Wide / Out-String / Out-File / Out-Host / Out-Null */
  function formattedObj(text) { return new PSObj('Microsoft.PowerShell.Commands.Internal.Format.FormatEndData', [], { fmt: 'formatted', text: text }); }
  function isDefaultFormatted(items) { return items.length && isObj(items[0]) && items[0].fmt && items[0].fmt !== 'table'; }
  function cmdFormatTable(ctx) {
    var P = ctx.p, S = S_(ctx), items = flattenForRender(inputItems(ctx)), width = ctx.cols;
    if (!items.length) return 0;
    if (P.Property === undefined) {
      var first = items[0];
      if (isFileObj(first) || (isObj(first) && first.fmt && first.fmt !== 'table') || typeof first !== 'object') { ctx.emitOne(formattedObj(renderObjs(items, S, width))); return 0; }
      ctx.emitOne(formattedObj(genericTable(items, null, width, { noHeader: !!P.HideTableHeaders })));
      return 0;
    }
    var cols = specCols(P.Property, items, S);
    ctx.emitOne(formattedObj(genericTable(items, cols, width, { noHeader: !!P.HideTableHeaders })));
    return 0;
  }
  function fileListText(items, width, names) {
    var DEF = ['Name', 'Length', 'CreationTime', 'LastWriteTime', 'LastAccessTime', 'Mode', 'LinkType', 'Target', 'VersionInfo'];
    var out = '', i = 0;
    while (i < items.length) {
      var d = fileDir(items[i]), j = i;
      while (j < items.length && fileDir(items[j]) === d) j++;
      var grp = items.slice(i, j);
      var body = listText(grp, names || DEF, width);
      out += '\n\n    目錄: ' + d + '\n\n\n' + body.replace(/^\n\n/, '');
      i = j;
    }
    return out;
  }
  function cmdFormatList(ctx) {
    var P = ctx.p, S = S_(ctx), items = flattenForRender(inputItems(ctx)), width = ctx.cols;
    if (!items.length) return 0;
    var names = P.Property === undefined ? null : specCols(P.Property, items, S);
    if (items.every(isFileObj)) { ctx.emitOne(formattedObj(names ? listText(items, names, width) : fileListText(items, width, null))); return 0; }
    if (isHash(items[0])) { items = items.map(function (h) { return new PSObj(T_CUSTOM, h.keys.map(function (k) { return [k, h.get(k)]; })); }); }
    if (typeof items[0] !== 'object') { ctx.emitOne(formattedObj(items.map(function (x) { return strOf(x) + '\n'; }).join(''))); return 0; }
    ctx.emitOne(formattedObj(listText(items, names, width)));
    return 0;
  }
  function cmdFormatWide(ctx) {
    var P = ctx.p, S = S_(ctx), items = flattenForRender(inputItems(ctx)), width = ctx.cols;
    if (!items.length) return 0;
    var pn = P.Property === undefined ? null : strOf(P.Property);
    var cells = items.map(function (it) { return strOf(pn === null ? (isObj(it) && it.file ? it.file.st.name : (isObj(it) && it.find('Name') ? it.get('Name') : it)) : getMember(it, pn, S)); });
    var cw = Math.max.apply(null, cells.map(displayWidth)) + 2;
    var cols = P.Column ? Number(P.Column) : Math.max(1, Math.floor(width / cw));
    var lines = [];
    for (var i = 0; i < cells.length; i += cols) lines.push(rtrim(cells.slice(i, i + cols).map(function (c) { return padR(c, cw); }).join('')));
    ctx.emitOne(formattedObj('\n' + lines.join('\n') + '\n\n\n'));
    return 0;
  }
  function cmdOutString(ctx) {
    var P = ctx.p, items = inputItems(ctx), text = renderObjs(items, S_(ctx), P.Width ? Number(P.Width) : 120);
    if (P.Stream) { text.replace(/\r?\n$/, '').split('\n').forEach(function (l) { ctx.emitOne(l); }); return 0; }
    ctx.emitOne(text);
    return 0;
  }
  function cmdOutHost(ctx) {
    var text = renderObjs(inputItems(ctx), S_(ctx), ctx.cols);
    ctx.host(text);
    return 0;
  }
  function cmdOutNull() { return 0; }
  /* write rendered text to a typed path; reports the PowerShell error and returns false when it cannot */
  function writeToPath(ctx, typed, text, append, cmdlet) {
    var s = ctx.session, r = resolvePath(s, typed);
    if (r.err) { failPathNotFound(ctx, { kind: r.err, disp: r.disp, drive: r.drive }); return false; }
    if (s.vfs.isDir(r.abs)) { ctx.fail({ msg: "拒絕存取路徑 '" + r.disp + "'。", cat: 'PermissionDenied', target: r.disp, activity: cmdlet, reason: 'UnauthorizedAccessException', fq: 'FileOpenFailure,' + CORE + 'OutFileCommand' }); return false; }
    try { s.vfs.writeFile(r.abs, text, { by: 'terminal', append: append }); }
    catch (e) { mapVfs(ctx, e, r.disp, cmdlet, 'FileOpenFailure'); return false; }
    return true;
  }
  function cmdOutFile(ctx) {
    var P = ctx.p, s = S_(ctx), typed = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.FilePath;
    var text = renderObjs(inputItems(ctx), s, P.Width ? Number(P.Width) : 120);
    var r = resolvePath(s, typed);
    if (P.NoClobber && !r.err && s.vfs.exists(r.abs) && !P.Append) {
      return ctx.fail({ msg: "檔案 '" + r.disp + "' 已經存在。", cat: 'ResourceExists', target: r.disp, activity: 'Out-File', reason: 'IOException', fq: 'NoClobber,' + CORE + 'OutFileCommand' });
    }
    return writeToPath(ctx, typed, P.NoNewline ? text.replace(/\n$/, '') : text, !!P.Append, 'Out-File') ? 0 : 1;
  }
  function cmdTee(ctx) {
    var P = ctx.p, items = inputItems(ctx), s = S_(ctx);
    if (P.Variable) setVar(s, P.Variable, items.length === 1 ? items[0] : items);
    var typed = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.FilePath;
    if (typed !== undefined && typed !== null) { if (!writeToPath(ctx, typed, renderObjs(items, s, 120), !!P.Append, 'Tee-Object')) return 1; }
    ctx.emit(items);
    return 0;
  }

  /* ---- Select-String (grep) */
  
  function matchObj(pathDisp, lineNo, line, pat, ctxLines, matches, ci, s) {
    var rel = pathDisp === null ? null : relPathText(s, pathDisp);
    var o = new PSObj('Microsoft.PowerShell.Commands.MatchInfo', [['IgnoreCase', ci], ['LineNumber', lineNo], ['Line', line], ['Filename', pathDisp === null ? 'InputStream' : pathDisp.slice(pathDisp.lastIndexOf('\\') + 1)],
      ['Path', pathDisp === null ? 'InputStream' : pathDisp], ['Pattern', pat], ['Context', null], ['Matches', matches]], { fmt: 'match' });
    o.str = function () {
      var base = rel === null ? line : rel + ':' + lineNo + ':' + line;
      if (!ctxLines) return base;
      var out = [];
      ctxLines.before.forEach(function (c) { out.push('  ' + (rel === null ? c.text : rel + ':' + c.no + ':' + c.text)); });
      out.push('> ' + base);
      ctxLines.after.forEach(function (c) { out.push('  ' + (rel === null ? c.text : rel + ':' + c.no + ':' + c.text)); });
      return out.join('\n');
    };
    return o;
  }
  function cmdSls(ctx) {
    var P = ctx.p, s = S_(ctx), vfs = s.vfs, status = 0;
    var pats = P.Pattern.filter(function (x) { return x !== null; });
    var ci = !P.CaseSensitive;
    var res = pats.map(function (p) { return P.SimpleMatch ? new RegExp(reEsc(p), ci ? 'i' : '') : netRegex(p, !ci, P.AllMatches ? 'g' : ''); });
    var cx = P.Context ? { before: Number(P.Context[0]), after: Number(P.Context.length > 1 ? P.Context[1] : P.Context[0]) } : null;
    var out = [];
    function scan(lines, pathDisp) {
      var any = false;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i], ms = null;
        res.forEach(function (re) { re.lastIndex = 0; var m = re.exec(line); if (m && !ms) ms = m; });
        var hit = !!ms;
        if (P.NotMatch) hit = !hit;
        if (!hit) continue;
        any = true;
        var matches = ms && !P.NotMatch ? [mkObj([['Value', ms[0]], ['Index', ms.index], ['Length', ms[0].length]], 'System.Text.RegularExpressions.Match', { str: function () { return ms[0]; }, fmt: 'table' })] : [];
        var cl = null;
        if (cx) {
          cl = { before: [], after: [] };
          for (var b = Math.max(0, i - cx.before); b < i; b++) cl.before.push({ no: b + 1, text: lines[b] });
          for (var a = i + 1; a <= Math.min(lines.length - 1, i + cx.after); a++) cl.after.push({ no: a + 1, text: lines[a] });
        }
        out.push(matchObj(pathDisp, i + 1, line, pats[0], cl, matches, ci, s));
        if (P.List) break;
      }
      return any;
    }
    function splitLines(text) { var l = String(text).replace(/\r\n/g, '\n').split('\n'); if (l.length && l[l.length - 1] === '') l.pop(); return l; }
    var literal = hasOwn.call(P, 'LiteralPath');
    var paths = literal ? P.LiteralPath : P.Path;
    if (paths && paths.length) {
      paths.forEach(function (arg) {
        if (arg === null) return;
        var ex = expandPath(s, arg, literal);
        if (ex.miss) { status = 1; failPathNotFound(ctx, ex.miss); return; }
        ex.items.forEach(function (it) {
          if (it.st.type === 'dir') { status = 1; ctx.fail({ msg: "拒絕存取路徑 '" + it.disp + "'。", cat: 'PermissionDenied', target: it.disp, activity: 'Select-String', reason: 'UnauthorizedAccessException', fq: 'ProcessingFile,' + CORE + 'SelectStringCommand' }); return; }
          if (it.st.kind === 'binary' || it.st.kind === 'zip' || it.st.kind === 'app') return;
          scan(splitLines(vfs.readFile(it.st.path, { by: 'terminal' })), it.disp);
        });
      });
    } else if (ctx.hasInput || P.InputObject !== undefined) {
      var inp = inputItems(ctx);
      inp.forEach(function (o) {
        if (isObj(o) && o.file) { if (o.file.st.type !== 'dir') scan(splitLines(vfs.readFile(o.file.st.path, { by: 'terminal' })), o.file.disp); return; }
        String(strOf(o)).split(/\r?\n/).forEach(function (ln) { scan([ln], null); });
      });
      // line numbers of pipeline input restart at 1 for every object: PowerShell numbers them per object too
    } else {
      return ctx.fail({ msg: '無法處理命令，因為至少遺失了一個必要參數:  Path。', cat: 'InvalidArgument', target: '', activity: 'Select-String', reason: 'ParameterBindingException', fq: 'MissingMandatoryParameter,' + CORE + 'SelectStringCommand' });
    }
    if (P.Quiet) { ctx.emitOne(out.length > 0); return status; }
    ctx.emit(out);
    return status;
  }

  /* ---- CSV and JSON */
  function parseCsv(text, delim, header) {
    var rows = [], row = [], cell = '', inQ = false, i = 0, n = text.length, sawAny = false;
    delim = delim || ',';
    while (i < n) {
      var c = text.charAt(i);
      if (inQ) {
        if (c === '"') { if (text.charAt(i + 1) === '"') { cell += '"'; i += 2; continue; } inQ = false; i++; continue; }
        cell += c; i++; continue;
      }
      if (c === '"' && cell === '') { inQ = true; sawAny = true; i++; continue; }
      if (c === delim) { row.push(cell); cell = ''; sawAny = true; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { if (sawAny || cell !== '') { row.push(cell); rows.push(row); } row = []; cell = ''; sawAny = false; i++; continue; }
      cell += c; sawAny = true; i++;
    }
    if (sawAny || cell !== '') { row.push(cell); rows.push(row); }
    if (rows.length && /^#TYPE /i.test(rows[0][0] || '')) rows.shift();
    var head = header ? header.slice() : (rows.length ? rows.shift() : []);
    var objs = rows.map(function (r) { return new PSObj(T_CUSTOM, head.map(function (h, k) { return [h === '' ? 'H' + (k + 1) : h, k < r.length ? r[k] : null]; }), { custom: true }); });
    return objs;
  }
  function csvQuote(v) { return v === null || v === undefined ? '' : '"' + strOf(v).replace(/"/g, '""') + '"'; }
  function csvLines(items, delim, noType) {
    var lines = [];
    if (!items.length) return lines;
    var first = items[0];
    var names = isHash(first) ? first.keys.map(strOf) : propNames(first);
    if (isObj(first) && first.file) names = ['PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider', 'PSIsContainer', 'Mode', 'BaseName', 'Target', 'LinkType', 'Name', 'Length', 'DirectoryName', 'Directory', 'IsReadOnly', 'Exists', 'FullName', 'Extension', 'CreationTime', 'CreationTimeUtc', 'LastAccessTime', 'LastAccessTimeUtc', 'LastWriteTime', 'LastWriteTimeUtc', 'Attributes'];
    if (!noType) lines.push('#TYPE ' + (isObj(first) && first.file ? (first.file.st.type === 'dir' ? 'System.IO.DirectoryInfo' : 'System.IO.FileInfo') : (typeNameOf(first) || T_OBJ)));
    lines.push(names.map(function (nm) { return '"' + nm.replace(/"/g, '""') + '"'; }).join(delim));
    items.forEach(function (it) { lines.push(names.map(function (nm) { var v = getMember(it, nm, null); return csvQuote(Array.isArray(v) ? strOf(v) : v); }).join(delim)); });
    return lines;
  }
  function cmdImportCsv(ctx) {
    var P = ctx.p, s = S_(ctx), status = 0;
    var literal = hasOwn.call(P, 'LiteralPath');
    var delim = P.Delimiter ? String(P.Delimiter).charAt(0) : ',';
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || !ex.items.length) {
        status = 1;
        ctx.fail({ msg: "找不到檔案 '" + (ex.resolved ? ex.resolved.disp : (ex.miss ? ex.miss.disp : arg)) + "'。", cat: 'OpenError', target: '', activity: 'Import-Csv', reason: 'FileNotFoundException', fq: 'FileOpenFailure,' + CORE + 'ImportCsvCommand' });
        return;
      }
      ex.items.forEach(function (it) {
        if (it.st.type === 'dir') { status = 1; ctx.fail({ msg: "拒絕存取路徑 '" + it.disp + "'。", cat: 'PermissionDenied', target: it.disp, activity: 'Import-Csv', reason: 'UnauthorizedAccessException', fq: 'FileOpenFailure,' + CORE + 'ImportCsvCommand' }); return; }
        var text = it.st.kind === 'binary' || it.st.kind === 'zip' || it.st.kind === 'app' ? '' : s.vfs.readFile(it.st.path, { by: 'terminal' });
        ctx.emit(parseCsv(text, delim, P.Header ? P.Header.map(strOf) : null));
      });
    });
    return status;
  }
  function cmdExportCsv(ctx) {
    var P = ctx.p, s = S_(ctx), items = inputItems(ctx);
    var typed = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.Path;
    if (typed === undefined || typed === null) {
      return ctx.fail({ msg: '無法處理命令，因為至少遺失了一個必要參數:  Path。', cat: 'InvalidArgument', target: '', activity: 'Export-Csv', reason: 'ParameterBindingException', fq: 'MissingMandatoryParameter,' + CORE + 'ExportCsvCommand' });
    }
    var delim = P.Delimiter ? String(P.Delimiter).charAt(0) : ',';
    var r = resolvePath(s, typed);
    if (P.NoClobber && !r.err && s.vfs.exists(r.abs) && !P.Append) return ctx.fail({ msg: "檔案 '" + r.disp + "' 已經存在。", cat: 'ResourceExists', target: r.disp, activity: 'Export-Csv', reason: 'IOException', fq: 'NoClobber,' + CORE + 'ExportCsvCommand' });
    var lines = csvLines(items, delim, !!P.NoTypeInformation || !!P.Append);
    if (P.Append && !r.err && s.vfs.exists(r.abs) && lines.length) lines.shift();       // the header is already in the file
    return writeToPath(ctx, typed, lines.length ? lines.join('\r\n') + '\r\n' : '', !!P.Append, 'Export-Csv') ? 0 : 1;
  }
  function cmdToCsv(ctx) {
    var P = ctx.p, items = inputItems(ctx);
    csvLines(items, P.Delimiter ? String(P.Delimiter).charAt(0) : ',', !!P.NoTypeInformation).forEach(function (l) { ctx.emitOne(l); });
    return 0;
  }
  function cmdFromCsv(ctx) {
    var P = ctx.p, items = inputItems(ctx);
    ctx.emit(parseCsv(items.map(strOf).join('\n'), P.Delimiter ? String(P.Delimiter).charAt(0) : ',', P.Header ? P.Header.map(strOf) : null));
    return 0;
  }
  function jsonStr(s) {
    return '"' + String(s).replace(/[\\"\u0000-\u001f<>&'\u2028\u2029]/g, function (c) {
      var map = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
      if (hasOwn.call(map, c)) return map[c];
      return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
    }) + '"';
  }
  /* PowerShell 5.1 ConvertTo-Json: four-space indent, two spaces after the colon, depth 2 by default */
  function toJson(v, depth, maxDepth, compress, indent) {
    var nl = compress ? '' : '\n', pad = function (n) { return compress ? '' : new Array(n * 4 + 1).join(' '); }, colon = compress ? ':' : ':  ';
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return numStr(v);
    if (typeof v === 'string') return jsonStr(v);
    if (isDate(v)) return '"\\/Date(' + (v.ms) + ')\\/"';
    if (depth > maxDepth) return jsonStr(strOf(v));
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return '[' + nl + v.map(function (x) { return pad(indent + 1) + toJson(x, depth + 1, maxDepth, compress, indent + 1); }).join(',' + nl) + nl + pad(indent) + ']';
    }
    var pairs = null;
    if (isHash(v)) pairs = v.keys.map(function (k) { return [strOf(k), v.get(k)]; });
    else if (isObj(v)) pairs = v.file ? fileProps(v).map(function (p) { return [p[0], p[1]]; }) : v.p.map(function (e) { return [e.n, e.v]; });
    if (pairs) {
      if (!pairs.length) return '{}';
      return '{' + nl + pairs.map(function (kv) { return pad(indent + 1) + jsonStr(kv[0]) + colon + toJson(kv[1], depth + 1, maxDepth, compress, indent + 1); }).join(',' + nl) + nl + pad(indent) + '}';
    }
    return jsonStr(strOf(v));
  }
  function cmdToJson(ctx) {
    var P = ctx.p, items = inputItems(ctx);
    if (P.InputObject !== undefined && !ctx.hasInput && !Array.isArray(P.InputObject) ) items = [P.InputObject];
    var v = items.length === 1 && !(P.InputObject !== undefined && Array.isArray(P.InputObject)) ? items[0] : items;
    if (!items.length && (P.InputObject === undefined || P.InputObject === null)) { ctx.emitOne('null'); return 0; }
    ctx.emitOne(toJson(v, 0, P.Depth !== undefined ? Number(P.Depth) : 2, !!P.Compress, 0));
    return 0;
  }
  function fromJsonValue(j) {
    if (j === null || typeof j !== 'object') return j;
    if (Array.isArray(j)) return j.map(fromJsonValue);
    return new PSObj(T_CUSTOM, Object.keys(j).map(function (k) { return [k, fromJsonValue(j[k])]; }), { custom: true });
  }
  function cmdFromJson(ctx) {
    var P = ctx.p, text = inputItems(ctx).map(strOf).join('\n');
    if (!ctx.hasInput && P.InputObject !== undefined) text = unroll(P.InputObject).map(strOf).join('\n');
    var j;
    try { j = JSON.parse(text); }
    catch (e) { return ctx.fail({ msg: '無法剖析 JSON 內容 (' + String(e.message).replace(/\n/g, ' ') + ')。', cat: 'InvalidOperation', target: '', activity: 'ConvertFrom-Json', reason: 'ArgumentException', fq: 'System.ArgumentException,' + CORE + 'ConvertFromJsonCommand' }); }
    var v = fromJsonValue(j);
    ctx.emit(v);
    return 0;
  }

  /* ---- Get-Member (short) */
  var BASE_METHODS = [['Equals', 'Method', 'bool Equals(System.Object obj)'], ['GetHashCode', 'Method', 'int GetHashCode()'], ['GetType', 'Method', 'type GetType()'], ['ToString', 'Method', 'string ToString()']];
  function cmdGetMember(ctx) {
    var items = inputItems(ctx), P = ctx.p;
    var groups = [], seen = {};
    items.forEach(function (it) {
      var tn = typeNameOf(it) || T_OBJ;
      if (seen[tn]) return;
      seen[tn] = 1;
      var rows = BASE_METHODS.map(function (m) { return [m[0], m[1], m[2]]; });
      if (isObj(it) && !it.file && it.type === T_CUSTOM) tn = T_CUSTOM;
      if (typeof it === 'string') { rows.push(['Contains', 'Method', 'bool Contains(string value)'], ['Replace', 'Method', 'string Replace(char oldChar, char newChar)'], ['Split', 'Method', 'string[] Split(Params char[] separator)'], ['Substring', 'Method', 'string Substring(int startIndex)'],
        ['ToLower', 'Method', 'string ToLower()'], ['ToUpper', 'Method', 'string ToUpper()'], ['Trim', 'Method', 'string Trim()'], ['Length', 'Property', 'int Length {get;}']); }
      else if (isObj(it)) {
        propNames(it).forEach(function (nm) {
          var v = getMember(it, nm, null);
          var t = v === null || v === undefined ? 'object' : (typeof v === 'string' ? 'string' : (typeof v === 'number' ? (Math.floor(v) === v ? 'int' : 'double') : (typeof v === 'boolean' ? 'bool' : (isDate(v) ? 'datetime' : (Array.isArray(v) ? 'Object[]' : 'System.Object')))));
          rows.push([nm, it.file ? 'Property' : 'NoteProperty', it.file ? t + ' ' + nm + ' {get;set;}' : t + ' ' + nm + '=' + (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? strOf(v) : strOf(v))]);
        });
      } else if (typeof it === 'number') { rows.push(['CompareTo', 'Method', 'int CompareTo(System.Object value)'], ['ToString', 'Method', 'string ToString()']); }
      rows.sort(function (a, b) { return a[1] === b[1] || (a[1] !== 'NoteProperty' && b[1] !== 'NoteProperty') ? strCmp(a[0], b[0]) : (a[1] === 'NoteProperty' ? 1 : -1); });
      if (P.Name && P.Name.length) rows = rows.filter(function (r) { return P.Name.some(function (n) { return wildRegex(n).test(r[0]); }); });
      if (P.MemberType) {
        var want = String(P.MemberType).toLowerCase().split(/\s*,\s*/);
        rows = rows.filter(function (r) {
          var t = r[1].toLowerCase();
          return want.some(function (w) { return w === 'all' || w === t || (w === 'properties' && /property$/.test(t)) || (w === 'methods' && t === 'method'); });
        });
      }
      rows.forEach(function (r) { groups.push(new PSObj('Microsoft.PowerShell.Commands.MemberDefinition', [['TypeName', tn], ['Name', r[0]], ['MemberType', r[1]], ['Definition', r[2]]], { fmt: 'member' })); });
    });
    if (!items.length) return ctx.fail({ msg: '您必須指定一個物件給 Get-Member Cmdlet。', cat: 'CloseError', target: '', activity: 'Get-Member', reason: 'InvalidOperationException', fq: 'NoObjectInGetMember,' + CORE + 'GetMemberCommand' });
    ctx.emit(groups);
    return 0;
  }
  function cmdGetUnique(ctx) { var items = inputItems(ctx), out = []; items.forEach(function (it) { if (!out.length || strOf(out[out.length - 1]) !== strOf(it)) out.push(it); }); ctx.emit(out); return 0; }
  function cmdGetRandom(ctx) {
    var P = ctx.p, items = inputItems(ctx);
    if (items.length || (P.InputObject !== undefined && Array.isArray(P.InputObject))) {
      var pool = items.length ? items : unroll(P.InputObject), n = P.Count !== undefined ? Number(P.Count) : 1, out = [], copy = pool.slice();
      for (var i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
      ctx.emit(out); return 0;
    }
    var hi = P.Maximum !== undefined ? toNum(P.Maximum) : 2147483647, lo = P.Minimum !== undefined ? toNum(P.Minimum) : 0;
    if (P.Maximum !== undefined && Array.isArray(P.Maximum)) { ctx.emitOne(P.Maximum[Math.floor(Math.random() * P.Maximum.length)]); return 0; }
    var count = P.Count !== undefined ? Number(P.Count) : 1;
    for (var k = 0; k < count; k++) ctx.emitOne(lo + Math.floor(Math.random() * (hi - lo)));
    return 0;
  }
  function cmdWriteWarn(ctx) { ctx.warn('警告: ' + ctx.p.Message + '\n'); return 0; }
  function cmdWriteErr(ctx) {
    var P = ctx.p;
    ctx.err(errorText({ head: ctx.src.slice(ctx.cmd.start, ctx.cmd.end), msg: P.Message, cat: P.Category || 'NotSpecified', target: P.TargetObject === undefined ? '' : strOf(P.TargetObject), activity: 'Write-Error', reason: 'WriteErrorException', fq: (P.ErrorId ? P.ErrorId + ',' : '') + CORE + 'WriteErrorException',
      src: ctx.src, start: ctx.cmd.start, len: Math.max(1, ctx.cmd.end - ctx.cmd.start) }, ctx.cols));
    return 1;
  }
  function* cmdReadHost(ctx) {
    var P = ctx.p;
    var prompt = P.Prompt === undefined || P.Prompt === null ? '' : strOf(unroll(P.Prompt)[0]) + ': ';
    var ans = yield { prompt: { text: prompt, kind: 'readhost' } };
    ctx.emitOne(ans === undefined ? '' : ans);
    return 0;
  }
  function cmdSetAlias(ctx) {
    var P = ctx.p, s = S_(ctx), tgt = String(P.Value).toLowerCase();
    if (!hasOwn.call(CMDS, tgt) && !hasOwn.call(s.aliases, tgt)) {
      // an alias to a name PowerShell cannot find still gets created; it fails when it is used
    }
    s.aliases[String(P.Name).toLowerCase()] = String(P.Value);
    if (P.PassThru) ctx.emitOne(aliasObj(P.Name, P.Value));
    return 0;
  }
  function cmdClip(ctx) {
    var P = ctx.p, items = ctx.hasInput ? ctx.input : unroll(P.Value === undefined ? [] : P.Value);
    var text = renderObjs(items, S_(ctx), 120).replace(/\n+$/, '');
    try { LAB.clipboard.setText(text); } catch (e) { /* the clipboard is the page's own */ }
    return 0;
  }
  function cmdGetClip(ctx) {
    var t = '';
    try { t = LAB.clipboard.text || ''; } catch (e) { t = ''; }
    if (t) { if (ctx.p.Raw) ctx.emitOne(t); else t.replace(/\r?\n$/, '').split(/\r?\n/).forEach(function (l) { ctx.emitOne(l); }); }
    return 0;
  }

  defCmd({ id: 'sort', canon: 'pipe', spec: SPEC.sort, run: cmdSort, nopaths: true }, ['Sort-Object', 'sort']);
  defCmd({ id: 'where', canon: 'pipe', spec: SPEC.where, run: cmdWhere, nopaths: true }, ['Where-Object', 'where', '?']);
  defCmd({ id: 'select', canon: 'pipe', spec: SPEC.select, run: cmdSelect, nopaths: true }, ['Select-Object', 'select']);
  defCmd({ id: 'measure', canon: 'pipe', spec: SPEC.measure, run: cmdMeasure, nopaths: true }, ['Measure-Object', 'measure']);
  defCmd({ id: 'group', canon: 'pipe', spec: SPEC.group, run: cmdGroup, nopaths: true }, ['Group-Object', 'group']);
  defCmd({ id: 'foreach', canon: 'pipe', spec: SPEC.foreach, run: cmdForEach, nopaths: true }, ['ForEach-Object', 'foreach', '%']);
  defCmd({ id: 'ft', canon: 'pipe', spec: SPEC.ft, run: cmdFormatTable, nopaths: true }, ['Format-Table', 'ft']);
  defCmd({ id: 'fl', canon: 'pipe', spec: SPEC.fl, run: cmdFormatList, nopaths: true }, ['Format-List', 'fl']);
  defCmd({ id: 'fw', canon: 'pipe', spec: SPEC.fw, run: cmdFormatWide, nopaths: true }, ['Format-Wide', 'fw']);
  defCmd({ id: 'outfile', canon: 'file', spec: SPEC.outfile, run: cmdOutFile }, ['Out-File']);
  defCmd({ id: 'outstring', canon: 'pipe', spec: SPEC.outstring, run: cmdOutString, nopaths: true }, ['Out-String']);
  defCmd({ id: 'outhost', canon: 'pipe', spec: SPEC.outhost, run: cmdOutHost, nopaths: true }, ['Out-Host', 'oh']);
  defCmd({ id: 'outnull', canon: 'pipe', spec: SPEC.outnull, run: cmdOutNull, nopaths: true }, ['Out-Null']);
  defCmd({ id: 'sls', canon: 'pipe', spec: SPEC.sls, run: cmdSls, nopaths: true }, ['Select-String', 'sls']);
  defCmd({ id: 'ipcsv', canon: 'csv', spec: SPEC.ipcsv, run: cmdImportCsv }, ['Import-Csv', 'ipcsv']);
  defCmd({ id: 'epcsv', canon: 'csv', spec: SPEC.epcsv, run: cmdExportCsv }, ['Export-Csv', 'epcsv']);
  defCmd({ id: 'tocsv', canon: 'csv', spec: SPEC.tocsv, run: cmdToCsv, nopaths: true }, ['ConvertTo-Csv']);
  defCmd({ id: 'fromcsv', canon: 'csv', spec: SPEC.fromcsv, run: cmdFromCsv, nopaths: true }, ['ConvertFrom-Csv']);
  defCmd({ id: 'tojson', canon: 'csv', spec: SPEC.tojson, run: cmdToJson, nopaths: true }, ['ConvertTo-Json']);
  defCmd({ id: 'fromjson', canon: 'csv', spec: SPEC.fromjson, run: cmdFromJson, nopaths: true }, ['ConvertFrom-Json']);
  defCmd({ id: 'tee', canon: 'pipe', spec: SPEC.tee, run: cmdTee }, ['Tee-Object', 'tee']);
  defCmd({ id: 'gm', canon: 'pipe', spec: SPEC.gm, run: cmdGetMember, nopaths: true }, ['Get-Member', 'gm']);
  defCmd({ id: 'unique', canon: 'pipe', spec: SPEC.unique, run: cmdGetUnique, nopaths: true }, ['Get-Unique', 'gu']);
  defCmd({ id: 'random', canon: 'pipe', spec: SPEC.random, run: cmdGetRandom, nopaths: true }, ['Get-Random']);
  defCmd({ id: 'writewarn', canon: 'echo', spec: SPEC.writewarn, run: cmdWriteWarn, nopaths: true }, ['Write-Warning']);
  defCmd({ id: 'writeerr', canon: 'echo', spec: SPEC.writeerr, run: cmdWriteErr, nopaths: true }, ['Write-Error']);
  defCmd({ id: 'readhost', canon: 'echo', spec: SPEC.readhost, run: cmdReadHost, nopaths: true }, ['Read-Host']);
  defCmd({ id: 'setalias', canon: 'var', spec: SPEC.setalias, run: cmdSetAlias, nopaths: true }, ['Set-Alias', 'sal', 'New-Alias', 'nal']);
  defCmd({ id: 'clip', canon: 'pipe', spec: SPEC.clip, run: cmdClip, nopaths: true }, ['Set-Clipboard', 'scb', 'clip']);
  defCmd({ id: 'getclip', canon: 'pipe', spec: SPEC.getclip, run: cmdGetClip, nopaths: true }, ['Get-Clipboard', 'gcb']);
  defCmd({ id: 'nothing', canon: 'echo', noargs: true, name: 'Write-Verbose', run: function () { return 0; }, nopaths: true }, ['Write-Verbose', 'Write-Debug', 'Write-Information']);

  /* ---- Resolve-Path / Split-Path / Join-Path / Test-Path -PathType */
  SPEC.resolve = { name: 'Resolve-Path', cls: CORE + 'ResolvePathCommand', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }),
    sw('Relative'), val('Credential', { type: 'System.Management.Automation.PSCredential' }), sw('UseTransaction', ['usetx'])] };
  SPEC.split = { name: 'Split-Path', cls: CORE + 'SplitPathCommand', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), sw('Qualifier'), sw('NoQualifier'),
    sw('Parent'), sw('Leaf'), sw('Resolve'), sw('IsAbsolute'), val('Credential', { type: 'System.Management.Automation.PSCredential' })] };
  SPEC.join = { name: 'Join-Path', cls: CORE + 'JoinPathCommand', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('ChildPath', { pos: 1, mand: true, type: T_STR }), val('AdditionalChildPath', { pos: 2, arr: true, type: T_ARR, rest: true }),
    sw('Resolve'), val('Credential', { type: 'System.Management.Automation.PSCredential' })] };
  function cmdResolve(ctx) {
    var s = ctx.session, P = ctx.p, status = 0, literal = hasOwn.call(P, 'LiteralPath');
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || (ex.wild && !ex.items.length)) { status = 1; failPathNotFound(ctx, ex.miss || { kind: 'path', disp: ex.disp || arg }); return; }
      ex.items.forEach(function (it) {
        var shown = P.Relative ? '.\\' + relPathText(s, it.disp) : it.disp;
        ctx.emitOne(new PSObj('System.Management.Automation.PathInfo', [['Drive', 'C'], ['Provider', 'Microsoft.PowerShell.Core\\FileSystem'], ['ProviderPath', it.disp], ['Path', shown]], { str: function () { return shown; }, fmt: 'path1' }));
      });
    });
    return status;
  }
  function cmdSplit(ctx) {
    var P = ctx.p, literal = hasOwn.call(P, 'LiteralPath');
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var norm = String(arg), q = /^[A-Za-z]:/.exec(norm);
      var qual = q ? q[0] : '', rest = q ? norm.slice(2) : norm;
      var trimmed = rest.length > 1 ? rest.replace(/[\\\/]+$/, '') : rest;
      var i = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
      var parent = i < 0 ? '' : (i === 0 ? trimmed.charAt(0) : trimmed.slice(0, i));
      var leaf = i < 0 ? trimmed : trimmed.slice(i + 1);
      if (P.IsAbsolute) { ctx.emitOne(/^[A-Za-z]:[\\\/]/.test(norm) || /^\\\\/.test(norm)); return; }
      if (P.Qualifier) { if (qual) ctx.emitOne(qual); return; }
      if (P.NoQualifier) { ctx.emitOne(rest); return; }
      if (P.Leaf) { ctx.emitOne(leaf); return; }
      var par = qual + parent;
      if (qual && parent === '') par = qual + (rest.charAt(0) === '\\' || rest.charAt(0) === '/' ? '\\' : '');
      ctx.emitOne(par);
    });
    return 0;
  }
  function cmdJoin(ctx) {
    var P = ctx.p, kids = [P.ChildPath].concat(P.AdditionalChildPath || []);
    pathArgs(ctx, P.Path).forEach(function (base) {
      var cur = base === null ? '' : String(base);
      kids.forEach(function (k) {
        if (k === null) return;
        var c = String(k).replace(/^[\\\/]+/, '');
        cur = cur === '' ? c : (/[\\\/]$/.test(cur) ? cur + c : cur + '\\' + c);
      });
      if (P.Resolve) { var r = resolvePath(ctx.session, cur); if (r.err || !ctx.session.vfs.exists(r.abs)) { failPathNotFound(ctx, { kind: 'path', disp: r.disp || cur }); return; } }
      ctx.emitOne(cur);
    });
    return 0;
  }

  /* ---- Get-FileHash: SHA-256 is real, the other algorithms are deterministic fakes of the right length */
  SPEC.hash = { name: 'Get-FileHash', cls: 'Get-FileHash', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }),
    val('InputStream', { type: 'System.IO.Stream' }), val('Algorithm', { pos: 1, type: T_STR })] };
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) { var cp = 0x10000 + ((c & 0x3ff) << 10) + (str.charCodeAt(++i) & 0x3ff); out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); }
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  var SHA_K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256Hex(bytes) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var msg = bytes.slice(), bitLen = bytes.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var hiLen = Math.floor(bitLen / 4294967296), loLen = bitLen >>> 0;
    msg.push((hiLen >>> 24) & 255, (hiLen >>> 16) & 255, (hiLen >>> 8) & 255, hiLen & 255, (loLen >>> 24) & 255, (loLen >>> 16) & 255, (loLen >>> 8) & 255, loLen & 255);
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var off = 0; off < msg.length; off += 64) {
      var w = new Array(64), i;
      for (i = 0; i < 16; i++) w[i] = ((msg[off + 4 * i] << 24) | (msg[off + 4 * i + 1] << 16) | (msg[off + 4 * i + 2] << 8) | msg[off + 4 * i + 3]) >>> 0;
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + SHA_K[i] + w[i]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0; h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return h.map(function (x) { return ('00000000' + x.toString(16)).slice(-8); }).join('').toUpperCase();
  }
  function hashFor(alg, bytes) {
    var a = String(alg).toUpperCase();
    if (a === 'SHA256') return sha256Hex(bytes);
    var len = { MD5: 32, SHA1: 40, SHA384: 96, SHA512: 128, RIPEMD160: 40, MACTRIPLEDES: 16 }[a];
    var out = '', k = 1;
    while (out.length < len) { out += sha256Hex(bytes.concat([k++])); }
    return out.slice(0, len);
  }
  function cmdHash(ctx) {
    var s = ctx.session, P = ctx.p, status = 0, literal = hasOwn.call(P, 'LiteralPath');
    var alg = P.Algorithm === undefined || P.Algorithm === null ? 'SHA256' : String(P.Algorithm);
    var ok = { SHA1: 'SHA1', SHA256: 'SHA256', SHA384: 'SHA384', SHA512: 'SHA512', MACTRIPLEDES: 'MACTripleDES', MD5: 'MD5', RIPEMD160: 'RIPEMD160' }[alg.toUpperCase()];
    if (!ok) {
      return ctx.fail({ msg: "無法驗證 Algorithm 參數的引數。引數 \"" + alg + "\" 不屬於 \"SHA1, SHA256, SHA384, SHA512, MACTripleDES, MD5, RIPEMD160\" 組。請提供屬於該組的引數，然後再試一次此命令。", cat: 'InvalidData', target: alg, ttype: 'String', activity: 'Get-FileHash', reason: 'ParameterBindingValidationException', fq: 'ParameterArgumentValidationError,Get-FileHash' });
    }
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || (ex.wild && !ex.items.length)) { status = 1; failPathNotFound(ctx, ex.miss || { kind: 'path', disp: ex.disp || arg }); return; }
      ex.items.forEach(function (it) {
        if (it.st.type === 'dir') { status = 1; ctx.fail({ msg: "拒絕存取路徑 '" + it.disp + "'。", cat: 'PermissionDenied', target: it.disp, activity: 'Get-FileHash', reason: 'UnauthorizedAccessException', fq: 'FileReadError,Get-FileHash' }); return; }
        var bytes = it.st.kind === 'binary' || it.st.kind === 'zip' || it.st.kind === 'app' ? utf8Bytes(it.st.name + ':' + it.st.size) : utf8Bytes(s.vfs.readFile(it.st.path, { by: 'terminal' }));
        ctx.emitOne(new PSObj('Microsoft.Powershell.Utility.FileHash', [['Algorithm', ok], ['Hash', hashFor(ok, bytes)], ['Path', it.disp]], { fmt: 'filehash' }));
      });
    });
    return status;
  }
  SPECIAL_VIEWS.filehash = function (group, S, width) {
    var room = Math.max(10, (width || 120) - 88);
    var lines = ['Algorithm       Hash                                                                   Path', '---------       ----                                                                   ----'];
    group.forEach(function (o) {
      var p = strOf(o.get('Path'));
      if (displayWidth(p) > room) p = p.slice(0, Math.max(0, room - 3)) + '...';
      lines.push(rtrim(padR(strOf(o.get('Algorithm')), 15) + ' ' + padR(strOf(o.get('Hash')), 71) + ' ' + p));
    });
    return '\n' + lines.join('\n') + '\n\n\n';
  };

  /* ---- Compress-Archive */
  SPEC.compress = { name: 'Compress-Archive', cls: 'Compress-Archive', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }),
    val('DestinationPath', { pos: 1, mand: true, type: T_STR }), val('CompressionLevel', { type: T_STR }), sw('Update'), sw('Force')] };
  function cmdCompress(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p, literal = hasOwn.call(P, 'LiteralPath');
    var srcs = [], status = 0;
    var args = pathArgs(ctx, literal ? P.LiteralPath : P.Path);
    for (var i = 0; i < args.length; i++) {
      var arg = args[i];
      if (arg === null) continue;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || !ex.items.length) {
        return ctx.fail({ msg: "路徑 '" + arg + "' 不存在或不是有效的檔案系統路徑。", cat: 'InvalidArgument', target: arg, activity: 'Compress-Archive', reason: 'InvalidOperationException', fq: 'ArchiveCmdletPathNotFound,Compress-Archive' });
      }
      ex.items.forEach(function (it) { srcs.push(it.abs); });
    }
    var destTyped = String(P.DestinationPath);
    if (!/\.zip$/i.test(destTyped)) destTyped += '.zip';
    var dr = resolvePath(s, destTyped);
    if (dr.err) return failPathNotFound(ctx, { kind: dr.err, disp: dr.disp, drive: dr.drive });
    var exists = vfs.exists(dr.abs);
    if (exists && !P.Update && !P.Force) {
      return ctx.fail({ msg: '保存檔案 ' + dr.disp + ' 已存在。請使用 -Update 參數來更新現有的保存檔案，或使用 -Force 參數來覆寫現有的保存檔案。', cat: 'InvalidArgument', target: dr.disp, activity: 'Compress-Archive', reason: 'IOException', fq: 'ArchiveFileExists,Compress-Archive' });
    }
    if (!vfs.isDir(vfs.dirname(dr.abs))) return failPathNotFound(ctx, { kind: 'path', disp: parentDisp(dr.disp) });
    if (!vfs.zipCreate) return ctx.fail({ msg: '練習版還沒有壓縮功能。', cat: 'NotImplemented', target: '', activity: 'Compress-Archive', reason: 'NotImplementedException', fq: 'NotImplemented,Compress-Archive' });
    var r = vfs.zipCreate(srcs, dr.abs, { by: 'terminal', overwrite: true, merge: !!P.Update && exists });
    if (!r.ok) {
      status = 1;
      ctx.fail({ msg: r.error === 'ENOSPC' ? '磁碟空間不足。' : "拒絕存取路徑 '" + dr.disp + "'。", cat: 'WriteError', target: dr.disp, activity: 'Compress-Archive', reason: 'IOException', fq: 'ArchiveCmdletWriteError,Compress-Archive' });
    }
    return status;
  }

  /* ---- tree (cmd's tree.com, zh-TW; box characters as the real one prints them in code page 950) */
  var VOL_SERIAL = '9E4C-7A21';
  function cmdTree(ctx) {
    var s = ctx.session, vfs = s.vfs, args = ctx.rawArgs.map(String), showFiles = false, ascii = false, target = null;
    args.forEach(function (a) {
      if (/^\/f$/i.test(a)) showFiles = true;
      else if (/^\/a$/i.test(a)) ascii = true;
      else if (/^[\/-]\?$/.test(a)) target = '?';
      else target = a;
    });
    if (target === '?') {
      ctx.out('以圖形顯示磁碟機或路徑的資料夾結構。\n\nTREE [磁碟機:][路徑] [/F] [/A]\n\n   /F   顯示每個資料夾中的檔案名稱。\n   /A   使用 ASCII 字元，而不使用擴充字元。\n');
      return 0;
    }
    var r = target === null ? { abs: s.cwd, disp: null } : resolvePath(s, target);
    ctx.out('列出資料夾 PATH\n磁碟區序號為 ' + VOL_SERIAL + '\n');
    if (r.err || !vfs.isDir(r.abs)) {
      var shownName = target === null ? '' : (r.disp || target).toUpperCase();
      ctx.out(shownName + '\n無效的路徑 - ' + shownName.replace(/^[A-Za-z]:/, '') + '\n子資料夾不存在 \n\n');
      return 1;
    }
    var rootLine = target === null ? 'C:.' : r.disp.toUpperCase();
    ctx.out(rootLine + '\n');
    var T = ascii ? { mid: '+---', last: '\\---', bar: '|   ', gap: '    ' } : { mid: '├─', last: '└─', bar: '│  ', gap: '    ' };
    var lines = [], anyDir = false;
    function walk(abs, prefix) {
      var kids = vfs.list(abs).filter(function (k) { return !isTrash(k); });
      var dirs = kids.filter(function (k) { return k.type === 'dir'; }).sort(function (a, b) { return ntfsCmp(a.name, b.name); });
      var files = kids.filter(function (k) { return k.type !== 'dir'; }).sort(function (a, b) { return ntfsCmp(a.name, b.name); });
      if (showFiles && files.length) {
        var ind = prefix + (dirs.length ? T.bar : T.gap);
        files.forEach(function (f) { lines.push(ind + f.name); });
        lines.push(ind);
      }
      dirs.forEach(function (d, i) {
        var last = i === dirs.length - 1;
        anyDir = true;
        lines.push(prefix + (last ? T.last : T.mid) + d.name);
        walk(d.path, prefix + (last ? T.gap : T.bar));
      });
    }
    walk(r.abs, '');
    if (!anyDir && !showFiles) { ctx.out('子資料夾不存在 \n\n'); return 0; }
    if (!anyDir && showFiles) { lines.push('子資料夾不存在 ', ''); }
    ctx.out(lines.join('\n') + (lines.length ? '\n' : ''));
    return 0;
  }

  /* ---- cmd /c dir and friends */
  function dirDate(ms) { var d = new Date(ms), p = dateParts(ms); return d.getFullYear() + '/' + two(d.getMonth() + 1) + '/' + two(d.getDate()) + '  ' + p[1]; }
  function groupDigits(n) { return commas(String(n)); }
  var DISK_FREE = 323191947264;           // 301 GB free of 475 GB (SPEC section 1)
  function cmdDir(ctx, argv) {
    var s = ctx.session, vfs = s.vfs, bare = false, onlyDirs = false, target = null, recurse = false;
    argv.forEach(function (a) {
      if (/^\/b$/i.test(a)) bare = true;
      else if (/^\/a:?d?$/i.test(a)) { if (/d$/i.test(a)) onlyDirs = true; }
      else if (/^\/s$/i.test(a)) recurse = true;
      else if (a.charAt(0) === '/') { /* other switches are accepted and ignored */ }
      else target = a.replace(/^"|"$/g, '');
    });
    var dirTyped = target === null ? '.' : target, pattern = null;
    var rr = resolvePath(s, dirTyped);
    if (!rr.err && !vfs.exists(rr.abs) && hasWild(dirTyped.replace(/\//g, '\\').split('\\').pop())) {
      var last = dirTyped.replace(/\//g, '\\').split('\\').pop();
      pattern = wildRegex(last);
      var cut = dirTyped.slice(0, dirTyped.length - last.length);
      rr = resolvePath(s, cut === '' ? '.' : cut);
    }
    var st = rr.err ? null : vfs.stat(rr.abs);
    if (st && st.type !== 'dir') { pattern = new RegExp('^' + reEsc(st.name) + '$', 'i'); rr = resolvePath(s, parentDisp(rr.disp)); st = vfs.stat(rr.abs); }
    var head = ' 磁碟區 C 中的磁碟沒有標籤。\n 磁碟區序號:  ' + VOL_SERIAL + '\n\n';
    if (!st) {
      if (!bare) ctx.out(head + ' ' + (rr.err ? rr.disp : rr.disp) + ' 的目錄\n\n');
      ctx.native('找不到檔案\n');
      return 1;
    }
    var kids = vfs.list(rr.abs).filter(function (k) { return !isTrash(k) && !isHiddenItem(k); });
    if (pattern) kids = kids.filter(function (k) { return pattern.test(k.name); });
    if (onlyDirs) kids = kids.filter(function (k) { return k.type === 'dir'; });
    kids.sort(function (a, b) { return ntfsCmp(a.name, b.name); });
    if (bare) {
      if (!kids.length) { ctx.native('找不到檔案\n'); return 1; }
      ctx.out(kids.map(function (k) { return k.name; }).join('\n') + '\n');
      return 0;
    }
    var out = head + ' ' + rr.disp + ' 的目錄\n\n';
    if (!kids.length && pattern) { ctx.out(out); ctx.native('找不到檔案\n'); return 1; }
    var rows = [];
    if (!pattern && rr.abs !== '/') {
      rows.push(dirDate(st.mtime) + '    <DIR>          .');
      rows.push(dirDate(st.mtime) + '    <DIR>          ..');
    }
    var nFiles = 0, nDirs = rr.abs !== '/' && !pattern ? 2 : 0, total = 0;
    kids.forEach(function (k) {
      if (k.type === 'dir') { nDirs++; rows.push(dirDate(k.mtime) + '    ' + padR('<DIR>', 14) + ' ' + k.name); }
      else { nFiles++; total += k.size; rows.push(dirDate(k.mtime) + '    ' + padL(groupDigits(k.size), 14) + ' ' + k.name); }
    });
    out += rows.join('\n') + (rows.length ? '\n' : '');
    out += padL(String(nFiles), 16) + ' 個檔案' + padL(groupDigits(total), 16) + ' 位元組\n';
    out += padL(String(nDirs), 16) + ' 個目錄' + padL(groupDigits(DISK_FREE), 17) + ' 位元組可用\n';
    ctx.out(out);
    return 0;
  }
  function cmdCmd(ctx) {
    var args = ctx.rawArgs.map(String), i = 0, line = null;
    while (i < args.length && /^\/[a-z]$/i.test(args[i]) && !/^\/[ck]$/i.test(args[i])) i++;
    if (i < args.length && /^\/[ck]$/i.test(args[i])) line = args.slice(i + 1).join(' ');
    if (line === null) {
      ctx.native('練習版的 cmd 一次只能執行一個指令，請用 cmd /c <指令>，例如 cmd /c dir。\n');
      return 1;
    }
    line = line.trim();
    var m = /^("[^"]*"|\S+)\s*(.*)$/.exec(line);
    if (!m) return 0;
    var word = m[1].replace(/^"|"$/g, ''), rest = m[2];
    function splitArgs(t) { var out = [], re = /"([^"]*)"|(\S+)/g, mm; while ((mm = re.exec(t))) out.push(mm[1] !== undefined ? mm[1] : mm[2]); return out; }
    var lw = word.toLowerCase();
    switch (lw) {
      case 'dir': return cmdDir(ctx, splitArgs(rest));
      case 'echo': {
        var env = ctx.session.envv;
        ctx.out(rest.replace(/%([^%]+)%/g, function (m0, n) { var k = n.toUpperCase(); return hasOwn.call(env, k) ? env[k] : m0; }) + '\n');
        return 0;
      }
      case 'ver': ctx.out('\nMicrosoft Windows [版本 10.0.26200.6584]\n'); return 0;
      case 'hostname': ctx.out(HOST + '\n'); return 0;
      case 'whoami': ctx.out(HOST.toLowerCase() + '\\' + USER + '\n'); return 0;
      case 'cls': ctx.effect({ type: 'clear' }); return 0;
      case 'type': {
        var tr = resolvePath(ctx.session, rest.replace(/^"|"$/g, '')), tst = tr.err ? null : ctx.session.vfs.stat(tr.abs);
        if (!tst || tst.type === 'dir') { ctx.native('系統找不到指定的檔案。\n'); return 1; }
        var txt = ctx.session.vfs.readFile(tst.path, { by: 'terminal' });
        ctx.out(txt.replace(/\r?\n$/, '') + '\n');
        return 0;
      }
      case 'cd': case 'chdir':
        if (!rest) { ctx.out(dispCwd(ctx.session) + '\n'); return 0; }
        ctx.native('練習版的 cmd /c 不會改變 PowerShell 所在的資料夾，請用 cd。\n'); return 0;
      case 'exit': return 0;
      default:
        ctx.native("'" + word + "' 不是內部或外部命令、可執行的程式或批次檔。\n");
        return 1;
    }
  }

  /* ---- where.exe */
  var WHERE_PATHS = { notepad: ['C:\\Windows\\System32\\notepad.exe', 'C:\\Windows\\notepad.exe'], cmd: ['C:\\Windows\\System32\\cmd.exe'], powershell: ['C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'],
    tar: ['C:\\Windows\\System32\\tar.exe'], ping: ['C:\\Windows\\System32\\PING.EXE'], ipconfig: ['C:\\Windows\\System32\\ipconfig.exe'], whoami: ['C:\\Windows\\System32\\whoami.exe'], hostname: ['C:\\Windows\\System32\\HOSTNAME.EXE'],
    tree: ['C:\\Windows\\System32\\tree.com'], calc: ['C:\\Windows\\System32\\calc.exe'], taskmgr: ['C:\\Windows\\System32\\Taskmgr.exe'], explorer: ['C:\\Windows\\explorer.exe'], curl: ['C:\\Windows\\System32\\curl.exe'],
    find: ['C:\\Windows\\System32\\find.exe'], findstr: ['C:\\Windows\\System32\\findstr.exe'], sort: ['C:\\Windows\\System32\\sort.exe'], more: ['C:\\Windows\\System32\\more.com'], where: ['C:\\Windows\\System32\\where.exe'],
    nslookup: ['C:\\Windows\\System32\\nslookup.exe'], tracert: ['C:\\Windows\\System32\\TRACERT.EXE'], systeminfo: ['C:\\Windows\\System32\\systeminfo.exe'], tasklist: ['C:\\Windows\\System32\\tasklist.exe'],
    taskkill: ['C:\\Windows\\System32\\taskkill.exe'], winget: ['C:\\Users\\' + USER + '\\AppData\\Local\\Microsoft\\WindowsApps\\winget.exe'], msedge: ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
    code: ['C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd', 'C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code'] };
  function whereTable(S) {
    var t = {};
    Object.keys(WHERE_PATHS).forEach(function (k) { t[k] = WHERE_PATHS[k]; });
    t.python = ['C:\\Users\\' + USER + '\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe'];
    t.python3 = ['C:\\Users\\' + USER + '\\AppData\\Local\\Microsoft\\WindowsApps\\python3.exe'];
    if (termState.installed.python) { t.python = ['C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\python.exe', t.python[0]]; t.pip = ['C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\pip.exe']; }
    if (termState.installed.git) { t.git = ['C:\\Program Files\\Git\\cmd\\git.exe']; }
    return t;
  }
  function cmdWhereExe(ctx) {
    var args = ctx.rawArgs.map(String).filter(function (a) { return a.charAt(0) !== '/'; }), tbl = whereTable(ctx.session), status = 0;
    if (!args.length) { ctx.native('錯誤: 指定的引數不足。\n輸入 "WHERE /?" 以取得使用方式。\n'); return 2; }
    args.forEach(function (a) {
      var key = a.toLowerCase().replace(/\.(exe|com|cmd|bat)$/, '');
      if (hasOwn.call(tbl, key)) ctx.out(tbl[key].join('\n') + '\n');
      else { status = 1; ctx.native('資訊: 找不到提供模式的檔案。\n'); }
    });
    return status;
  }
  defCmd({ id: 'wherexe', canon: 'file', native: true, name: 'where.exe', run: cmdWhereExe, nopaths: true }, ['where.exe']);
  /* findstr / find: the text filters every Windows tutorial uses after a pipe (`ipconfig | findstr IPv4`) or on a file. Literal strings (space = OR) unless /R. */
  function textLinesOf(text) { var l = String(text).replace(/\r\n/g, '\n').split('\n'); if (l.length && l[l.length - 1] === '') l.pop(); return l; }
  function cmdFindstr(ctx) {
    var args = ctx.rawArgs.map(String), f = {}, pats = [], files = [], i, a;
    for (i = 0; i < args.length; i++) {
      a = args[i];
      if (/^\/c:/i.test(a)) { pats.push(a.slice(3)); f.c = true; continue; }
      if (/^\/f:/i.test(a) || /^\/g:/i.test(a) || /^\/d:/i.test(a) || /^\/a:/i.test(a) || /^\/off/i.test(a)) continue;
      if (a.charAt(0) === '/' && a.length > 1) { a.slice(1).toLowerCase().split('').forEach(function (ch) { f[ch] = true; }); continue; }
      if (!pats.length && !f.c) { a.split(/ +/).forEach(function (w) { if (w) pats.push(w); }); continue; }
      files.push(a);
    }
    if (!pats.length) { ctx.native('FINDSTR: 沒有指定搜尋字串。\n'); return 2; }
    var res = pats.map(function (w) {
      var src = f.r ? w : reEsc(w);
      if (f.x) src = '^(?:' + src + ')$'; else if (f.b) src = '^(?:' + src + ')';
      try { return new RegExp(src, f.i ? 'i' : ''); } catch (e) { return new RegExp(reEsc(w), f.i ? 'i' : ''); }
    });
    var out = [], status = 1, vfs = ctx.session.vfs;
    function scan(lines, prefix) {
      lines.forEach(function (line, n) {
        var hit = res.some(function (re) { return re.test(line); });
        if (f.v) hit = !hit;
        if (!hit) return;
        status = 0;
        out.push((prefix ? prefix + ':' : '') + (f.n ? (n + 1) + ':' : '') + line);
      });
    }
    if (files.length) {
      var many = files.length > 1 || f.s;
      files.forEach(function (arg) {
        var ex = expandPath(ctx.session, arg, false);
        if (ex.miss || !ex.items.length) { ctx.native('FINDSTR: 無法開啟 ' + arg + '\n'); return; }
        ex.items.forEach(function (it) {
          if (it.st.type === 'dir') { ctx.native('FINDSTR: 無法開啟 ' + it.disp + '\n'); return; }
          scan(textLinesOf(vfs.readFile(it.st.path, { by: 'terminal' })), many ? it.st.name : '');
        });
      });
    } else if (ctx.hasInput) {
      var lines = [];
      ctx.input.forEach(function (o) { textLinesOf(strOf(o)).forEach(function (l) { lines.push(l); }); });
      scan(lines, '');
    }
    if (out.length) ctx.out(out.join('\n') + '\n');
    return status;
  }
  function cmdFind(ctx) {
    var args = ctx.rawArgs.map(String), f = {}, str = null, files = [];
    args.forEach(function (a) {
      if (a.charAt(0) === '/' && a.length > 1) { f[a.slice(1).toLowerCase()] = true; return; }
      if (str === null) str = a; else files.push(a);
    });
    if (str === null) { ctx.native('FIND: 參數格式不正確\n'); return 2; }
    var re = new RegExp(reEsc(str), f.i ? 'i' : ''), status = 1, vfs = ctx.session.vfs, out = [];
    function scan(lines, title) {
      var hits = [];
      lines.forEach(function (line, n) { var h = re.test(line); if (f.v) h = !h; if (h) hits.push((f.n ? '[' + (n + 1) + ']' : '') + line); });
      if (hits.length) status = 0;
      if (f.c) { out.push(title ? '---------- ' + title + ': ' + hits.length : String(hits.length)); return; }
      if (title) out.push('', '---------- ' + title);
      hits.forEach(function (h) { out.push(h); });
    }
    if (files.length) files.forEach(function (arg) {
      var ex = expandPath(ctx.session, arg, false);
      if (ex.miss || !ex.items.length) { ctx.native('File not found - ' + arg.toUpperCase() + '\n'); return; }
      ex.items.forEach(function (it) { scan(textLinesOf(vfs.readFile(it.st.path, { by: 'terminal' })), it.st.name.toUpperCase()); });
    });
    else if (ctx.hasInput) {
      var lines = [];
      ctx.input.forEach(function (o) { textLinesOf(strOf(o)).forEach(function (l) { lines.push(l); }); });
      scan(lines, '');
    }
    if (out.length) ctx.out(out.join('\n') + '\n');
    return status;
  }
  defCmd({ id: 'findstr', canon: 'pipe', native: true, name: 'findstr', run: cmdFindstr, nopaths: true }, ['findstr']);
  defCmd({ id: 'find', canon: 'pipe', native: true, name: 'find', run: cmdFind, nopaths: true }, ['find']);
  defCmd({ id: 'cmd', canon: 'sys', native: true, name: 'cmd', run: cmdCmd, nopaths: true }, ['cmd']);
  defCmd({ id: 'tree', canon: 'file', native: true, name: 'tree', run: cmdTree, nopaths: true }, ['tree', 'tree.com']);
  defCmd({ id: 'resolve', canon: 'file', spec: SPEC.resolve, run: cmdResolve }, ['Resolve-Path', 'rvpa']);
  defCmd({ id: 'split', canon: 'file', spec: SPEC.split, run: cmdSplit, nopaths: true }, ['Split-Path']);
  defCmd({ id: 'join', canon: 'file', spec: SPEC.join, run: cmdJoin, nopaths: true }, ['Join-Path']);
  defCmd({ id: 'hash', canon: 'file', spec: SPEC.hash, run: cmdHash }, ['Get-FileHash']);
  defCmd({ id: 'compress', canon: 'file', spec: SPEC.compress, run: cmdCompress }, ['Compress-Archive']);

  /* ====================================================================================================================
     Round 5 — system cmdlets and programs: Get-Date, Get-Process / Stop-Process / tasklist / taskkill, Get-Service, Get-ComputerInfo / systeminfo,
     Get-Command / Get-Alias / Get-Help. Everything here is fake data that follows SPEC section 1 (user an, AN-LAPTOP, Windows 11 25H2 build 26200.6584).
     ==================================================================================================================== */
           // the session that is running (strOf of a file item shows a path relative to its folder)

  /* ---- Get-Date */
  SPEC.date = { name: 'Get-Date', cls: CORE + 'GetDateCommand', params: [val('Date', { pos: 0, raw: true, type: 'System.DateTime', pipe: true }), val('Year', { type: 'System.Int32' }), val('Month', { type: 'System.Int32' }), val('Day', { type: 'System.Int32' }),
    val('Hour', { type: 'System.Int32' }), val('Minute', { type: 'System.Int32' }), val('Second', { type: 'System.Int32' }), val('Millisecond', { type: 'System.Int32' }), val('DisplayHint', { type: T_STR }),
    val('Format', { type: T_STR }), val('UFormat', { type: T_STR })] };
  function cmdGetDate(ctx) {
    var P = ctx.p, ms = LAB.clock.ms();
    if (P.Date !== undefined && P.Date !== null) {
      var dv = unroll(P.Date)[0];
      if (isDate(dv)) ms = dv.ms;
      else { var pm = parseDateStr(strOf(dv)); if (pm === null) return ctx.fail({ msg: '無法將 "' + strOf(dv) + '" 值轉換為 "System.DateTime" 型別。錯誤: "字串未被辨識為有效的 DateTime。"', cat: 'InvalidArgument', target: '', activity: 'Get-Date', reason: 'ParameterBindingArgumentTransformationException', fq: 'ParameterArgumentTransformationError,' + CORE + 'GetDateCommand', tokStart: ctx.cmd.start, tokLen: ctx.cmd.end - ctx.cmd.start }); ms = pm; }
    }
    var d = new Date(ms);
    ['Year', 'Month', 'Day', 'Hour', 'Minute', 'Second', 'Millisecond'].forEach(function (k) {
      if (P[k] === undefined) return;
      var v = Number(P[k]);
      if (k === 'Year') d.setFullYear(v); else if (k === 'Month') d.setMonth(v - 1); else if (k === 'Day') d.setDate(v); else if (k === 'Hour') d.setHours(v);
      else if (k === 'Minute') d.setMinutes(v); else if (k === 'Second') d.setSeconds(v); else d.setMilliseconds(v);
    });
    ms = d.getTime();
    if (P.Format !== undefined) { ctx.emitOne(formatDate(ms, P.Format === null ? '' : P.Format)); return 0; }
    if (P.UFormat !== undefined) { ctx.emitOne(ufmtDate(ms, P.UFormat === null ? '' : P.UFormat)); return 0; }
    ctx.emitOne(mkDate(ms));
    return 0;
  }

  /* ---- processes: the system ones are fixed; the apps that are really open in the lab are added with fixed PIDs */
  var SYS_PROCS = [
    ['Idle', 0, 0, 0, 60, 8, null, 0, 0], ['System', 4, 3562, 0, 192, 11204, null, 0, 0.002], ['Registry', 124, 0, 0, 5748, 108684, null, 0, 0], ['smss', 640, 53, 3, 1104, 1456, null, 0, 0],
    ['csrss', 884, 658, 22, 2020, 5972, null, 0, 0.01], ['csrss', 980, 784, 25, 2488, 6240, null, 1, 0.01], ['wininit', 1016, 177, 12, 1384, 6560, null, 0, 0], ['winlogon', 1044, 316, 13, 2764, 12544, null, 1, 0],
    ['services', 1100, 705, 21, 7324, 14624, null, 0, 0.004], ['lsass', 1128, 1624, 33, 10412, 28460, null, 0, 0.01], ['svchost', 1304, 1822, 38, 21408, 40216, null, 0, 0.006], ['fontdrvhost', 1332, 52, 6, 1788, 5456, 0.14, 1, 0],
    ['svchost', 1380, 1155, 24, 12644, 25100, null, 0, 0.003], ['dwm', 1520, 1402, 42, 86340, 118400, 188.06, 1, 0.12], ['svchost', 1612, 592, 17, 6212, 14756, null, 0, 0.002], ['svchost', 1904, 424, 14, 4560, 11920, null, 0, 0.001],
    ['svchost', 2088, 305, 13, 3548, 8508, null, 0, 0.001], ['svchost', 2320, 411, 16, 4408, 10140, null, 0, 0.002], ['MsMpEng', 2956, 1230, 62, 218012, 164200, null, 0, 0.05], ['spoolsv', 3140, 410, 14, 6312, 12480, null, 0, 0],
    ['sihost', 3568, 531, 24, 5360, 25344, 1.27, 1, 0], ['svchost', 3624, 410, 20, 5280, 22008, 2.88, 1, 0.001], ['taskhostw', 3780, 270, 14, 3896, 17884, 1.02, 1, 0], ['ctfmon', 4204, 487, 21, 4780, 22624, 3.11, 1, 0.002],
    ['explorer', 5276, 3450, 105, 61248, 143612, 74.38, 1, 0.03], ['StartMenuExperienceHost', 5644, 678, 28, 24968, 59108, 3.5, 1, 0], ['SearchHost', 5788, 1034, 49, 112460, 171500, 21.31, 1, 0.004], ['RuntimeBroker', 5936, 391, 19, 5424, 28264, 0.94, 1, 0],
    ['RuntimeBroker', 6120, 318, 14, 3936, 23648, 0.39, 1, 0], ['TextInputHost', 6408, 622, 30, 18576, 49984, 4.67, 1, 0.001], ['ShellExperienceHost', 6584, 541, 29, 16988, 52452, 1.62, 1, 0], ['SecurityHealthSystray', 6992, 176, 9, 1976, 9144, 0.17, 1, 0],
    ['SecurityHealthService', 7104, 612, 12, 4096, 12048, null, 0, 0], ['OneDrive', 7412, 891, 41, 52084, 98724, 12.94, 1, 0.002], ['RuntimeBroker', 7660, 280, 12, 2640, 17420, 0.28, 1, 0]];
  /* app id -> [process name, [extra helper process names], first pid, handles, npm, pm, ws, cpu per second, path, company] */
  var APP_PROCS = {
    terminal: ['WindowsTerminal', ['OpenConsole'], 10440, 1015, 42, 118820, 152340, 0.02, 'C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminal_1.24.12741.0_x64__8wekyb3d8bbwe\\WindowsTerminal.exe', 'Microsoft Corporation'],
    codex: ['Codex', ['Codex', 'Codex'], 11200, 702, 38, 212440, 284100, 0.03, 'C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Codex\\Codex.exe', 'OpenAI'],
    code: ['Code', ['Code', 'Code', 'Code'], 12480, 640, 36, 189420, 241560, 0.025, 'C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe', 'Microsoft Corporation'],
    textedit: ['Notepad', [], 9876, 388, 20, 21520, 62440, 0.004, 'C:\\Program Files\\WindowsApps\\Microsoft.WindowsNotepad_11.2509.14.0_x64__8wekyb3d8bbwe\\Notepad\\Notepad.exe', 'Microsoft Corporation'],
    edge: ['msedge', ['msedge', 'msedge', 'msedge'], 13800, 520, 28, 98210, 164800, 0.03, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'Microsoft Corporation'],
    settings: ['SystemSettings', [], 8820, 744, 31, 41120, 88640, 0.002, 'C:\\Windows\\ImmersiveControlPanel\\SystemSettings.exe', 'Microsoft Corporation'],
    calculator: ['CalculatorApp', [], 9250, 372, 17, 17480, 52320, 0.001, 'C:\\Program Files\\WindowsApps\\Microsoft.WindowsCalculator_11.2508.4.0_x64__8wekyb3d8bbwe\\CalculatorApp.exe', 'Microsoft Corporation'],
    taskmgr: ['Taskmgr', [], 7440, 612, 26, 31860, 74920, 0.01, 'C:\\WINDOWS\\system32\\Taskmgr.exe', 'Microsoft Corporation'],
    photos: ['Microsoft.Photos', [], 12960, 704, 33, 91240, 158700, 0.008, 'C:\\Program Files\\WindowsApps\\Microsoft.Windows.Photos_2025.11090.22001.0_x64__8wekyb3d8bbwe\\Microsoft.Photos.exe', 'Microsoft Corporation']
  };
  function jitter(seed, bucket) { var x = Math.sin(seed * 12.9898 + bucket * 78.233) * 43758.5453; return x - Math.floor(x); }
  /* the process list of the practice PC right now: [{name, id, handles, npm, pm, ws, cpu, si, title, path, company, app, protect}] sorted like Get-Process */
  function localProcessList(S) {
    var now = LAB.clock.ms(), t0 = new Date(2026, 9, 2, 9, 52, 0).getTime(), secs = Math.max(0, (now - t0) / 1000), bucket = Math.floor(now / 3000);
    var list = [];
    function add(r) { list.push(r); }
    SYS_PROCS.forEach(function (p) {
      var j = jitter(p[1], bucket), hasCpu = p[6] !== null;
      add({ name: p[0], id: p[1], handles: p[2] + Math.floor(j * 6), npm: p[3], pm: p[4] + Math.floor(j * 48), ws: p[5] + Math.floor(j * 160), cpu: hasCpu ? p[6] + secs * p[8] + j * 0.3 : null, si: p[7], title: '', path: '', protect: true });
    });
    var wins = [];
    try { wins = LAB.wm && LAB.wm.all ? LAB.wm.all() : []; } catch (e) { wins = []; }
    var byApp = {};
    wins.forEach(function (w) { if (w.appId && hasOwn.call(APP_PROCS, w.appId)) (byApp[w.appId] = byApp[w.appId] || []).push(w); });
    Object.keys(byApp).forEach(function (appId) {
      var info = APP_PROCS[appId], ws = byApp[appId];
      var count = appId === 'terminal' ? ws.length : 1;
      for (var k = 0; k < count; k++) {
        var win = ws[k] || ws[0], title = '';
        try { title = win.getTitle ? win.getTitle() : ''; } catch (e) { title = ''; }
        var pid = info[2] + 4 * k, j = jitter(pid, bucket);
        add({ name: info[0], id: pid, handles: info[3] + Math.floor(j * 8), npm: info[4], pm: info[5] + Math.floor(j * 300), ws: info[6] + Math.floor(j * 500), cpu: 4.5 + k + secs * info[7] + j * 0.4, si: 1, title: title, path: info[8], company: info[9], app: appId });
        if (appId === 'terminal') {
          add({ name: 'powershell', id: 8200 + 4 * k, handles: 612 + Math.floor(j * 10), npm: 31, pm: 66240, ws: 82440 + Math.floor(j * 300), cpu: 1.2 + secs * 0.004 + j * 0.2, si: 1, title: '', path: 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', company: 'Microsoft Corporation', app: 'terminal', child: true });
          add({ name: 'OpenConsole', id: 9100 + 4 * k, handles: 172, npm: 11, pm: 3480, ws: 11820, cpu: 0.2 + j * 0.05, si: 1, title: '', path: '', app: 'terminal', child: true });
        }
      }
      // helper processes of the bigger apps (Code, Edge, Codex have several)
      if (appId !== 'terminal') info[1].forEach(function (nm, h) {
        var pid2 = info[2] + 4 + 4 * h, j2 = jitter(pid2, bucket);
        add({ name: nm, id: pid2, handles: 260 + Math.floor(j2 * 30), npm: 18, pm: 44200 + Math.floor(j2 * 500), ws: 78400 + Math.floor(j2 * 900), cpu: 0.8 + h * 0.3 + secs * info[7] * 0.4, si: 1, title: '', path: info[8], company: info[9], app: appId, child: true });
      });
    });
    var explorerRow = list.filter(function (r) { return r.name === 'explorer'; })[0];
    if (explorerRow) {
      explorerRow.app = 'finder';
      var fw = wins.filter(function (w) { return w.appId === 'finder'; });
      try { explorerRow.title = fw.length && fw[fw.length - 1].getTitle ? fw[fw.length - 1].getTitle() : ''; } catch (e) { /* none */ }
      explorerRow.path = 'C:\\WINDOWS\\explorer.exe';
    }
    list.sort(function (a, b) { return ntfsCmp(a.name, b.name) || a.id - b.id; });
    return list;
  }
  /* LAB.sys.processes() is the one table of the PC (Task Manager reads it too): same names, same fixed PIDs. Guarded: without it the local table above is used. */
  function sysProcesses() {
    try { var sp = LAB.sys && typeof LAB.sys.processes === 'function' ? LAB.sys.processes() : null; return Array.isArray(sp) && sp.length ? sp : null; } catch (e) { return null; }
  }
  function processList(S) {
    var sp = sysProcesses();
    if (!sp) return localProcessList(S);
    var now = LAB.clock.ms(), t0 = new Date(2026, 9, 2, 9, 52, 0).getTime(), secs = Math.max(0, (now - t0) / 1000);
    var list = [{ name: 'Idle', id: 0, handles: 0, npm: 0, pm: 0, ws: 8, cpu: 0, si: 0, title: '', path: '', protect: true }];
    sp.forEach(function (p) {
      var info = p.appId && hasOwn.call(APP_PROCS, p.appId) ? APP_PROCS[p.appId] : null, mine = p.user === 'an';
      var ws = Math.max(8, Math.round((p.mem || 0) * 1024)), win0 = p.windows && p.windows.length ? p.windows[0] : null;
      var j = jitter(p.pid, 3), pct = (p.cpu || 0) / 100;
      var r = { name: p.name, id: p.pid, handles: info ? (p.main ? info[3] : 260) + Math.floor(j * 40) : 120 + (p.pid % 640), npm: info ? (p.main ? info[4] : 16) : 5 + (p.pid % 38),
        pm: Math.round(ws * (0.55 + 0.2 * j)), ws: ws, cpu: (mine || info) ? 0.3 + (p.pid % 29) / 4 + secs * pct + j * 0.2 : null, si: mine ? 1 : 0,
        title: win0 && p.main ? win0.title : '', path: info ? info[8] : (p.name === 'System' || p.name === 'Registry' || p.name === 'Memory Compression' ? '' : 'C:\\WINDOWS\\System32\\' + p.exe),
        company: info ? info[9] : (p.name === 'System' ? null : 'Microsoft Corporation'), protect: p.kind !== 'app', sysPid: p.pid };
      if (p.appId) r.app = p.appId;
      if (p.group === 'child') r.child = true;
      if (p.appId === 'finder') r.path = 'C:\\WINDOWS\\explorer.exe';
      if (p.name === 'powershell') r.path = 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      if (p.name === 'OpenConsole') r.path = '';
      list.push(r);
    });
    list.sort(function (a, b) { return ntfsCmp(a.name, b.name) || a.id - b.id; });
    return list;
  }
  function procObj(r) {
    return new PSObj('System.Diagnostics.Process', [['Handles', r.handles], ['NPM', r.npm], ['PM', r.pm], ['WS', r.ws], ['CPU', r.cpu === null ? null : Math.round(r.cpu * 100) / 100], ['Id', r.id], ['SI', r.si], ['ProcessName', r.name],
      ['Name', r.name], ['MainWindowTitle', r.title || ''], ['Path', r.path || null], ['Company', r.company || null], ['Responding', true], ['StartTime', mkDate(new Date(2026, 9, 2, 8, 31, 0).getTime() + r.id * 100)]], { fmt: 'process', str: function () { return 'System.Diagnostics.Process (' + r.name + ')'; }, proc: r });
  }
  SPEC.gps = { name: 'Get-Process', cls: CORE + 'GetProcessCommand', params: [val('Name', { pos: 0, arr: true, type: T_ARR, al: ['ProcessName'] }), val('Id', { arr: true, type: 'System.Int32[]', al: ['PID'] }), val('InputObject', { arr: true, raw: true, type: 'System.Diagnostics.Process[]' }),
    sw('IncludeUserName'), sw('FileVersionInfo'), sw('Module'), val('ComputerName', { arr: true, type: T_ARR, al: ['Cn'] })] };
  function noProcessErr(ctx, what, cmdName, cls) {
    return ctx.fail({ msg: '找不到名稱為 "' + what + '" 的處理序。請確認該處理序名稱，然後再呼叫一次 Cmdlet。', cat: 'ObjectNotFound', target: what, ttype: 'String', activity: cmdName, reason: 'ProcessCommandException', fq: 'NoProcessFoundForGivenName,' + CORE + cls });
  }
  function cmdGetProcess(ctx) {
    var P = ctx.p, list = processList(ctx.session), status = 0, out = [];
    if (P.Name) {
      P.Name.forEach(function (n) {
        if (n === null) return;
        var re = wildRegex(String(n).replace(/\.exe$/i, ''));
        var hit = list.filter(function (r) { return re.test(r.name); });
        if (!hit.length) { status = 1; noProcessErr(ctx, n, 'Get-Process', 'GetProcessCommand'); return; }
        hit.forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); });
      });
    } else if (P.Id) {
      P.Id.forEach(function (n) {
        var hit = list.filter(function (r) { return r.id === Number(n); });
        if (!hit.length) { status = 1; ctx.fail({ msg: '找不到識別碼為 ' + n + ' 的處理序。請確認處理序識別碼，然後再呼叫一次 Cmdlet。', cat: 'ObjectNotFound', target: String(n), ttype: 'Int32', activity: 'Get-Process', reason: 'ProcessCommandException', fq: 'NoProcessFoundForGivenId,' + CORE + 'GetProcessCommand' }); return; }
        out.push(hit[0]);
      });
    } else out = list;
    ctx.emit(out.map(procObj));
    return status;
  }
  /* Stop-Process: closes the windows of the app for real; system processes refuse like a normal user's PowerShell does */
  SPEC.spps = { name: 'Stop-Process', cls: CORE + 'StopProcessCommand', risk: true, params: [val('Id', { pos: 0, mand: true, arr: true, type: 'System.Int32[]', pipe: true }), val('Name', { arr: true, type: T_ARR, al: ['ProcessName'], mand: true, pipe: true }),
    val('InputObject', { arr: true, raw: true, type: 'System.Diagnostics.Process[]', mand: true, pipe: true }), sw('PassThru'), sw('Force')] };
  SPEC.spps.params[0].mandUnless = ['Name', 'InputObject']; SPEC.spps.params[1].mandUnless = ['Id', 'InputObject']; SPEC.spps.params[2].mandUnless = ['Id', 'Name'];
  function killRow(ctx, r, status) {
    if (!r.app) {
      ctx.fail({ msg: '無法停止處理序 "' + r.name + ' (' + r.id + ')"，因為發生錯誤 "拒絕存取。"。', cat: 'CloseError', target: 'System.Diagnostics.Process (' + r.name + ')', ttype: 'Process', activity: 'Stop-Process', reason: 'ProcessCommandException', fq: 'CouldNotStopProcess,' + CORE + 'StopProcessCommand' });
      return 1;
    }
    ctx.effect({ type: 'kill', appId: r.app, pid: r.id });
    return status;
  }
  function cmdStopProcess(ctx) {
    var P = ctx.p, list = processList(ctx.session), status = 0, hit = [];
    function addRow(r) { if (hit.indexOf(r) < 0) hit.push(r); }
    if (P.Name) {
      P.Name.forEach(function (n) {
        if (n === null) return;
        var re = wildRegex(String(n).replace(/\.exe$/i, ''));
        var m = list.filter(function (r) { return re.test(r.name); });
        if (!m.length) { status = 1; noProcessErr(ctx, n, 'Stop-Process', 'StopProcessCommand'); return; }
        m.forEach(addRow);
      });
    }
    var ids = P.Id ? P.Id.map(Number) : [];
    if (ctx.hasInput && !P.Name && !P.Id) {
      ctx.input.forEach(function (o) { if (isObj(o) && o.proc) ids.push(o.proc.id); else if (typeof o === 'number') ids.push(o); });
    }
    if (P.InputObject) unroll(P.InputObject).forEach(function (o) { if (isObj(o) && o.proc) ids.push(o.proc.id); });
    ids.forEach(function (id) {
      var m = list.filter(function (r) { return r.id === id; });
      if (!m.length) { status = 1; ctx.fail({ msg: '找不到識別碼為 ' + id + ' 的處理序。', cat: 'ObjectNotFound', target: String(id), ttype: 'Int32', activity: 'Stop-Process', reason: 'ProcessCommandException', fq: 'NoProcessFoundForGivenId,' + CORE + 'StopProcessCommand' }); return; }
      addRow(m[0]);
    });
    var killedApps = {};
    hit.forEach(function (r) {
      if (P.WhatIf) { ctx.host('WhatIf: 正在目標 "' + r.name + ' (' + r.id + ')" 上執行 "Stop-Process" 操作。\n'); return; }
      if (r.app && killedApps[r.app]) return;
      var st = killRow(ctx, r, 0);
      if (st) status = 1; else if (r.app) killedApps[r.app] = 1;
      if (!st && P.PassThru) ctx.emitOne(procObj(r));
    });
    return status;
  }
  /* tasklist / taskkill (zh-TW) */
  function imageName(r) { return /^(Idle)$/.test(r.name) ? 'System Idle Process' : (r.name === 'System' || r.name === 'Registry' || /^Secure System$/.test(r.name) ? r.name : r.name + '.exe'); }
  function cmdTasklist(ctx) {
    var args = ctx.rawArgs.map(String), list = processList(ctx.session), noHeader = false, fmt = 'table', filters = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i].toLowerCase();
      if (a === '/nh') noHeader = true;
      else if (a === '/fo') fmt = String(args[++i] || 'table').toLowerCase();
      else if (a === '/fi') { var m = /^\s*(\w+)\s+(eq|ne)\s+(.*)$/i.exec(String(args[++i] || '')); if (m) filters.push({ k: m[1].toLowerCase(), op: m[2].toLowerCase(), v: m[3].replace(/^"|"$/g, '').trim() }); }
    }
    var rows = list.map(function (r) { return { img: imageName(r), id: r.id, sess: r.si ? 'Console' : 'Services', no: r.si, mem: r.ws }; });
    rows.unshift({ img: 'System Idle Process', id: 0, sess: 'Services', no: 0, mem: 8 });
    rows = rows.filter(function (r, i, arr) { return !(r.img === 'System Idle Process' && i > 0 && arr[0].img === r.img && arr.indexOf(r) !== 0); });
    rows.sort(function (a, b) { return a.id - b.id; });
    filters.forEach(function (f) {
      rows = rows.filter(function (r) {
        var v = f.k === 'imagename' ? r.img : (f.k === 'pid' ? String(r.id) : (f.k === 'sessionname' ? r.sess : null));
        if (v === null) return true;
        var eq = wildRegex(f.v).test(v);
        return f.op === 'eq' ? eq : !eq;
      });
    });
    if (!rows.length) { ctx.out('資訊: 沒有執行中的工作符合指定的準則。\n'); return 0; }
    if (fmt === 'csv') {
      ctx.out((noHeader ? '' : '"映像名稱","PID","工作階段名稱","工作階段 #","RAM使用量"\n') + rows.map(function (r) { return '"' + r.img + '","' + r.id + '","' + r.sess + '","' + r.no + '","' + groupDigits(r.mem) + ' K"'; }).join('\n') + '\n');
      return 0;
    }
    var lines = [];
    if (!noHeader) lines.push('', padR('映像名稱', 25) + ' ' + padL('PID', 8) + ' ' + padR('工作階段名稱', 16) + ' ' + padL('工作階段 #', 11) + ' ' + padL('RAM使用量', 12), '========================= ======== ================ =========== ============');
    rows.forEach(function (r) { lines.push(padR(r.img, 25) + ' ' + padL(String(r.id), 8) + ' ' + padR(r.sess, 16) + ' ' + padL(String(r.no), 11) + ' ' + padL(groupDigits(r.mem) + ' K', 12)); });
    ctx.out(lines.join('\n') + '\n');
    return 0;
  }
  function cmdTaskkill(ctx) {
    var args = ctx.rawArgs.map(String), list = processList(ctx.session), names = [], pids = [], force = false;
    for (var i = 0; i < args.length; i++) {
      var a = args[i].toLowerCase();
      if (a === '/im') names.push(String(args[++i] || '')); else if (a === '/pid') pids.push(Number(args[++i])); else if (a === '/f') force = true;
    }
    if (!names.length && !pids.length) { ctx.native('錯誤: 指定的引數不足。\n輸入 "TASKKILL /?" 以取得使用方式。\n'); return 1; }
    var status = 0, killed = {};
    names.forEach(function (n) {
      var key = n.toLowerCase().replace(/\.exe$/, ''), re = wildRegex(key);
      var m = list.filter(function (r) { return re.test(r.name.toLowerCase()); });
      if (!m.length) { status = 128; ctx.native('錯誤: 找不到處理程序 "' + n + '"。\n'); return; }
      m.forEach(function (r) { status = killTarget(ctx, r, force, killed) || status; });
    });
    pids.forEach(function (id) {
      var m = list.filter(function (r) { return r.id === id; });
      if (!m.length) { status = 128; ctx.native('錯誤: 找不到處理程序 "' + id + '"。\n'); return; }
      status = killTarget(ctx, m[0], force, killed) || status;
    });
    return status;
  }
  function killTarget(ctx, r, force, killed) {
    if (!r.app) { ctx.native('錯誤: 無法終止 PID 為 ' + r.id + ' 的處理程序。\n原因: 拒絕存取。\n'); return 1; }
    if (!killed[r.app]) { killed[r.app] = 1; ctx.effect({ type: 'kill', appId: r.app, pid: r.id }); }
    ctx.out(force ? '成功: 已終止處理程序 "' + imageName(r) + '"，其 PID 為 ' + r.id + '。\n' : '成功: 已將終止訊號傳送給處理程序 "' + imageName(r) + '"，其 PID 為 ' + r.id + '。\n');
    return 0;
  }

  /* ---- services (a short, believable list) */
  var SERVICES = [['AppXSvc', 'AppX Deployment Service (AppXSVC)', 'Running'], ['AudioEndpointBuilder', 'Windows 音訊端點建立器', 'Running'], ['Audiosrv', 'Windows 音訊', 'Running'], ['BFE', 'Base Filtering Engine', 'Running'],
    ['BITS', '背景智慧型傳送服務', 'Stopped'], ['BrokerInfrastructure', 'Background Tasks Infrastructure Service', 'Running'], ['BthAvctpSvc', 'AVCTP 服務', 'Running'], ['bthserv', '藍牙支援服務', 'Running'], ['CDPSvc', 'Connected Devices Platform Service', 'Running'],
    ['CryptSvc', 'Cryptographic Services', 'Running'], ['DcomLaunch', 'DCOM Server Process Launcher', 'Running'], ['Dhcp', 'DHCP Client', 'Running'], ['DiagTrack', 'Connected User Experiences and Telemetry', 'Running'], ['Dnscache', 'DNS Client', 'Running'],
    ['EventLog', 'Windows Event Log', 'Running'], ['EventSystem', 'COM+ Event System', 'Running'], ['FontCache', 'Windows Font Cache Service', 'Running'], ['LanmanServer', 'Server', 'Running'], ['LanmanWorkstation', 'Workstation', 'Running'],
    ['mpssvc', 'Windows Defender Firewall', 'Running'], ['NlaSvc', 'Network Location Awareness', 'Running'], ['PlugPlay', 'Plug and Play', 'Running'], ['Power', 'Power', 'Running'], ['ProfSvc', 'User Profile Service', 'Running'],
    ['RpcSs', 'Remote Procedure Call (RPC)', 'Running'], ['SamSs', 'Security Accounts Manager', 'Running'], ['Schedule', 'Task Scheduler', 'Running'], ['SecurityHealthService', 'Windows 安全性服務', 'Running'], ['Spooler', 'Print Spooler', 'Running'],
    ['SysMain', 'SysMain', 'Running'], ['TimeBrokerSvc', 'Time Broker', 'Running'], ['UserManager', 'User Manager', 'Running'], ['Wcmsvc', 'Windows Connection Manager', 'Running'], ['WdiServiceHost', 'Diagnostic Service Host', 'Stopped'],
    ['WinDefend', 'Microsoft Defender Antivirus Service', 'Running'], ['Winmgmt', 'Windows Management Instrumentation', 'Running'], ['WlanSvc', 'WLAN AutoConfig', 'Running'], ['wscsvc', 'Security Center', 'Running'], ['wuauserv', 'Windows Update', 'Stopped']];
  SPEC.gsv = { name: 'Get-Service', cls: CORE + 'GetServiceCommand', params: [val('Name', { pos: 0, arr: true, type: T_ARR, al: ['ServiceName'] }), val('DisplayName', { arr: true, type: T_ARR }), val('Include', { arr: true, type: T_ARR }),
    val('Exclude', { arr: true, type: T_ARR }), sw('DependentServices', ['DS']), sw('RequiredServices', ['SDO', 'ServicesDependedOn']), val('InputObject', { arr: true, raw: true, type: T_OBJ })] };
  function svcObj(r) {
    return new PSObj('System.ServiceProcess.ServiceController', [['Status', r[2]], ['Name', r[0]], ['DisplayName', r[1]], ['ServiceName', r[0]], ['CanStop', r[2] === 'Running'], ['StartType', r[2] === 'Running' ? 'Automatic' : 'Manual']], { fmt: 'service' });
  }
  function cmdGetService(ctx) {
    var P = ctx.p, status = 0, out = [];
    if (P.Name) {
      P.Name.forEach(function (n) {
        var re = wildRegex(String(n)), hit = SERVICES.filter(function (r) { return re.test(r[0]); });
        if (!hit.length && !hasWild(String(n))) { status = 1; ctx.fail({ msg: "找不到任何服務名稱為 '" + n + "' 的服務。", cat: 'ObjectNotFound', target: String(n), ttype: 'String', activity: 'Get-Service', reason: 'ServiceCommandException', fq: 'NoServiceFoundForGivenName,' + CORE + 'GetServiceCommand' }); return; }
        hit.forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); });
      });
    } else if (P.DisplayName) {
      P.DisplayName.forEach(function (n) {
        var re = wildRegex(String(n)), hit = SERVICES.filter(function (r) { return re.test(r[1]); });
        if (!hit.length && !hasWild(String(n))) { status = 1; ctx.fail({ msg: "找不到任何顯示名稱為 '" + n + "' 的服務。", cat: 'ObjectNotFound', target: String(n), ttype: 'String', activity: 'Get-Service', reason: 'ServiceCommandException', fq: 'NoServiceFoundForGivenDisplayName,' + CORE + 'GetServiceCommand' }); return; }
        hit.forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); });
      });
    } else out = SERVICES.slice();
    out.sort(function (a, b) { return ntfsCmp(a[0], b[0]); });
    ctx.emit(out.map(svcObj));
    return status;
  }

  /* ---- Get-ComputerInfo and systeminfo (simplified: the real ones print a hundred more lines) */
  var HW = { vendor: 'LENOVO', model: '83DR', mem: 16 * 1024 * 1024 * 1024, serial: 'PF4Y7K2A', bios: 'LENOVO N3CN28WW, 2025/6/12' };
  Object.defineProperty(HW, 'cpu', { enumerable: true, get: function () { return sysInfo('CPU', 'Intel(R) Core(TM) Ultra 5 125U'); } });
  /* 原始安裝日期 follows LAB.sys.info.INSTALLED (2026/9/1) */
  function installMs() {
    var m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(String(sysInfo('INSTALLED', '')));
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 11, 42, 9).getTime() : new Date(2026, 8, 7, 11, 42, 9).getTime();
  }
  function usableMB() { var m = /^([\d.]+)\s*GB/i.exec(String(sysInfo('RAM_AVAIL', ''))); return m ? Math.round(parseFloat(m[1]) * 1024) : 15694; }
  SPEC.gci2 = { name: 'Get-ComputerInfo', cls: CORE + 'GetComputerInfoCommand', params: [val('Property', { pos: 0, arr: true, type: T_ARR })] };
  function cmdGetComputerInfo(ctx) {
    var P = ctx.p;
    var pairs = [['WindowsBuildLabEx', '26100.1.amd64fre.ge_release.240331-1435'], ['WindowsCurrentVersion', '6.3'], ['WindowsEditionId', 'Core'], ['WindowsInstallationType', 'Client'], ['WindowsInstallDateFromRegistry', mkDate(installMs())],
      ['WindowsProductName', 'Windows 10 Home'], ['WindowsRegisteredOwner', USER], ['WindowsSystemRoot', 'C:\\WINDOWS'], ['WindowsVersion', '2009'], ['OSDisplayVersion', '25H2'], ['BiosManufacturer', HW.vendor], ['BiosVersion', HW.bios],
      ['CsDNSHostName', HOST], ['CsDomain', 'WORKGROUP'], ['CsManufacturer', HW.vendor], ['CsModel', HW.model], ['CsName', HOST], ['CsNumberOfLogicalProcessors', 14], ['CsNumberOfProcessors', 1], ['CsProcessors', [HW.cpu]],
      ['CsTotalPhysicalMemory', HW.mem], ['CsUserName', HOST + '\\' + USER], ['OsName', 'Microsoft Windows 11 家用版'], ['OsType', 'WINNT'], ['OsVersion', '10.0.26200'], ['OsBuildNumber', '26200'], ['OsSystemDrive', 'C:'],
      ['OsWindowsDirectory', 'C:\\WINDOWS'], ['OsLocale', 'zh-TW'], ['OsLocalDateTime', mkDate(LAB.clock.ms())], ['OsLastBootUpTime', mkDate(new Date(2026, 9, 2, 8, 31, 25).getTime())], ['OsArchitecture', '64 位元'], ['OsLanguage', 'zh-TW'],
      ['KeyboardLayout', 'zh-TW'], ['TimeZone', '(UTC+08:00) 台北'], ['PowerPlatformRole', 'Mobile']];
    if (P.Property) {
      var want = P.Property.map(function (x) { return String(x).toLowerCase(); }), sel = pairs.filter(function (kv) { return want.some(function (w) { return wildRegex(w).test(kv[0]); }); });
      ctx.emitOne(new PSObj('Microsoft.PowerShell.Commands.ComputerInfo', sel, { custom: true }));
      return 0;
    }
    ctx.emitOne(new PSObj('Microsoft.PowerShell.Commands.ComputerInfo', pairs, { custom: true }));
    return 0;
  }
  function cmdSysteminfo(ctx) {
    var dt = function (ms) { var d = new Date(ms); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ', ' + dTT(d) + ' ' + two(dH12(d)) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()); };
    var rows = [['主機名稱:', HOST], ['作業系統名稱:', 'Microsoft Windows 11 家用版'], ['OS 版本:', '10.0.26200 N/A 組建 26200'], ['作業系統製造商:', 'Microsoft Corporation'], ['作業系統設定:', '獨立工作站'],
      ['作業系統組建類型:', 'Multiprocessor Free'], ['註冊的擁有者:', USER], ['註冊公司:', 'N/A'], ['產品識別碼:', sysInfo('PRODUCT_ID', '00342-35588-11237-AAOEM')], ['原始安裝日期:', dt(installMs())],
      ['系統開機時間:', dt(new Date(2026, 9, 2, 8, 31, 25).getTime())], ['系統製造商:', HW.vendor], ['系統型號:', HW.model], ['系統類型:', 'x64-based PC']];
    var lines = [''];
    function row(label, val) { lines.push(padR(label, 22) + val); }
    rows.forEach(function (r) { row(r[0], r[1]); });
    lines.push(padR('處理器:', 22) + '已安裝 1 處理器。', padR('', 22) + '[01]: Intel64 Family 6 Model 170 Stepping 4 GenuineIntel ~1300 Mhz');
    [['BIOS 版本:', HW.bios], ['Windows 目錄:', 'C:\\WINDOWS'], ['系統目錄:', 'C:\\WINDOWS\\system32'], ['開機裝置:', '\\Device\\HarddiskVolume1'], ['系統地區設定:', 'zh-tw;中文 (台灣)'], ['輸入法地區設定:', 'zh-tw;中文 (台灣)'],
      ['時區:', '(UTC+08:00) 台北'], ['實體記憶體總計:', groupDigits(usableMB()) + ' MB'], ['可用實體記憶體:', '6,512 MB'], ['虛擬記憶體: 大小上限:', '17,742 MB'], ['虛擬記憶體: 可用:', '7,901 MB'], ['虛擬記憶體: 使用中:', '9,841 MB'],
      ['分頁檔位置:', 'C:\\pagefile.sys'], ['網域:', 'WORKGROUP'], ['登入伺服器:', '\\\\' + HOST]].forEach(function (r) {
      if (r[0].indexOf('虛擬記憶體') === 0) lines.push(padR(r[0], 22 - (displayWidth(r[0]) > 20 ? 0 : 0)) + r[1]); else row(r[0], r[1]);
    });
    lines.push(padR('Hotfix:', 22) + '已安裝 2 Hotfix。', padR('', 22) + '[01]: KB5066835', padR('', 22) + '[02]: KB5065426',
      padR('網路卡:', 22) + '已安裝 2 NIC。', padR('', 22) + '[01]: ' + NET.adapter, padR('', 28) + padR('連線名稱:', 20) + 'Wi-Fi', padR('', 28) + padR('DHCP 已啟用:', 20) + '是', padR('', 28) + padR('DHCP 伺服器:', 20) + NET.gw,
      padR('', 28) + 'IP 位址', padR('', 28) + '[01]: ' + NET.ip, padR('', 28) + '[02]: fe80::7c3e:9a1d:5b42:8e6f', padR('', 22) + '[02]: Bluetooth Device (Personal Area Network)', padR('', 28) + padR('連線名稱:', 20) + '藍牙網路連線', padR('', 28) + padR('狀態:', 20) + '媒體已中斷連線');
    lines.push(padR('Hyper-V 需求:', 22) + 'VM 監視器模式延伸: 是', padR('', 22) + '韌體中已啟用虛擬化: 是', padR('', 22) + '第二層位址轉譯: 是', padR('', 22) + '資料執行防止可用: 是');
    ctx.out(lines.join('\n') + '\n');
    return 0;
  }

  /* ---- Get-Command / Get-Alias */
  var ALIAS_RAW = '%=ForEach-Object;?=Where-Object;ac=Add-Content;asnp=Add-PSSnapin;cat=Get-Content;cd=Set-Location;CFS=ConvertFrom-String,3.1.0.0,Microsoft.PowerShell.Utility;chdir=Set-Location;clc=Clear-Content;clear=Clear-Host;clhy=Clear-History;cli=Clear-Item;clp=Clear-ItemProperty;cls=Clear-Host;clv=Clear-Variable;cnsn=Connect-PSSession;compare=Compare-Object;copy=Copy-Item;cp=Copy-Item;cpi=Copy-Item;cpp=Copy-ItemProperty;curl=Invoke-WebRequest;cvpa=Convert-Path;dbp=Disable-PSBreakpoint;del=Remove-Item;diff=Compare-Object;dir=Get-ChildItem;dnsn=Disconnect-PSSession;ebp=Enable-PSBreakpoint;echo=Write-Output;epal=Export-Alias;epcsv=Export-Csv;epsn=Export-PSSession;erase=Remove-Item;etsn=Enter-PSSession;exsn=Exit-PSSession;fc=Format-Custom;fhx=Format-Hex,3.1.0.0,Microsoft.PowerShell.Utility;fl=Format-List;foreach=ForEach-Object;ft=Format-Table;fw=Format-Wide;gal=Get-Alias;gbp=Get-PSBreakpoint;gc=Get-Content;gcb=Get-Clipboard,3.1.0.0,Microsoft.PowerShell.Management;gci=Get-ChildItem;gcm=Get-Command;gcs=Get-PSCallStack;gdr=Get-PSDrive;ghy=Get-History;gi=Get-Item;gin=Get-ComputerInfo,3.1.0.0,Microsoft.PowerShell.Management;gjb=Get-Job;gl=Get-Location;gm=Get-Member;gmo=Get-Module;gp=Get-ItemProperty;gps=Get-Process;gpv=Get-ItemPropertyValue;group=Group-Object;gsn=Get-PSSession;gsnp=Get-PSSnapin;gsv=Get-Service;gtz=Get-TimeZone,3.1.0.0,Microsoft.PowerShell.Management;gu=Get-Unique;gv=Get-Variable;gwmi=Get-WmiObject;h=Get-History;history=Get-History;icm=Invoke-Command;iex=Invoke-Expression;ihy=Invoke-History;ii=Invoke-Item;ipal=Import-Alias;ipcsv=Import-Csv;ipmo=Import-Module;ipsn=Import-PSSession;irm=Invoke-RestMethod;ise=powershell_ise.exe;iwmi=Invoke-WmiMethod;iwr=Invoke-WebRequest;kill=Stop-Process;lp=Out-Printer;ls=Get-ChildItem;man=help;md=mkdir;measure=Measure-Object;mi=Move-Item;mount=New-PSDrive;move=Move-Item;mp=Move-ItemProperty;mv=Move-Item;nal=New-Alias;ndr=New-PSDrive;ni=New-Item;nmo=New-Module;npssc=New-PSSessionConfigurationFile;nsn=New-PSSession;nv=New-Variable;ogv=Out-GridView;oh=Out-Host;popd=Pop-Location;ps=Get-Process;pushd=Push-Location;pwd=Get-Location;r=Invoke-History;rbp=Remove-PSBreakpoint;rcjb=Receive-Job;rcsn=Receive-PSSession;rd=Remove-Item;rdr=Remove-PSDrive;ren=Rename-Item;ri=Remove-Item;rjb=Remove-Job;rm=Remove-Item;rmdir=Remove-Item;rmo=Remove-Module;rni=Rename-Item;rnp=Rename-ItemProperty;rp=Remove-ItemProperty;rsn=Remove-PSSession;rsnp=Remove-PSSnapin;rujb=Resume-Job;rv=Remove-Variable;rvpa=Resolve-Path;rwmi=Remove-WmiObject;sajb=Start-Job;sal=Set-Alias;saps=Start-Process;sasv=Start-Service;sbp=Set-PSBreakpoint;sc=Set-Content;scb=Set-Clipboard,3.1.0.0,Microsoft.PowerShell.Management;select=Select-Object;set=Set-Variable;shcm=Show-Command;si=Set-Item;sl=Set-Location;sleep=Start-Sleep;sls=Select-String;sort=Sort-Object;sp=Set-ItemProperty;spjb=Stop-Job;spps=Stop-Process;spsv=Stop-Service;start=Start-Process;stz=Set-TimeZone,3.1.0.0,Microsoft.PowerShell.Management;sujb=Suspend-Job;sv=Set-Variable;swmi=Set-WmiInstance;tee=Tee-Object;trcm=Trace-Command;type=Get-Content;wget=Invoke-WebRequest;where=Where-Object;wjb=Wait-Job;write=Write-Output';
  var ALIASES = {};            // lower-case alias -> {name, def, version, source}
  ALIAS_RAW.split(';').forEach(function (e) {
    var p = e.split('=');
    if (p.length < 2) return;
    var rest = p.slice(1).join('=').split(',');
    ALIASES[p[0].toLowerCase()] = { name: p[0], def: rest[0], version: rest[1] || '', source: rest[2] || '' };
  });
  var CMDLET_MODULE = (function () {
    var m = {};
    function put(mod, ver, names) { names.split(' ').forEach(function (n) { m[n.toLowerCase()] = { module: mod, version: ver }; }); }
    put('Microsoft.PowerShell.Management', '3.1.0.0', 'Get-ChildItem Get-Item Set-Location Get-Location Push-Location Pop-Location New-Item Move-Item Copy-Item Remove-Item Rename-Item Get-Content Set-Content Add-Content Test-Path Resolve-Path Split-Path Join-Path Get-Process Stop-Process Start-Process Get-Service Get-ComputerInfo Invoke-Item Test-Connection Get-Clipboard Set-Clipboard Clear-Host');
    put('Microsoft.PowerShell.Utility', '3.1.0.0', 'Sort-Object Select-Object Measure-Object Group-Object Format-Table Format-List Format-Wide Out-File Out-String Select-String Import-Csv Export-Csv ConvertTo-Csv ConvertFrom-Csv ConvertTo-Json ConvertFrom-Json Tee-Object Get-Member Get-Unique Get-Random Write-Output Write-Host Write-Warning Write-Error Write-Verbose Write-Debug Write-Information Read-Host Get-Date Start-Sleep Get-FileHash Invoke-WebRequest Invoke-RestMethod Get-Alias Set-Alias New-Alias Get-Variable Set-Variable');
    put('Microsoft.PowerShell.Core', '3.0.0.0', 'Get-Command Get-Help Get-History ForEach-Object Where-Object Out-Host Out-Null');
    put('Microsoft.PowerShell.Archive', '1.0.1.0', 'Compress-Archive Expand-Archive');
    return m;
  })();
  var NATIVE_NAMES = ['ipconfig', 'ping', 'nslookup', 'tracert', 'systeminfo', 'tasklist', 'taskkill', 'tar', 'whoami', 'hostname', 'tree', 'cmd', 'curl', 'calc', 'taskmgr', 'notepad', 'explorer', 'where', 'powershell', 'winget', 'code', 'git', 'python', 'msedge'];
  function nativePath(name, S) {
    var t = whereTable(S), key = name.toLowerCase();
    if (!hasOwn.call(t, key)) return null;
    var p = t[key][0];
    return p.replace(/^C:\\Windows\\/, 'C:\\WINDOWS\\').replace(/^C:\\WINDOWS\\System32/, 'C:\\WINDOWS\\system32');
  }
  function cmdInfoObj(type, name, version, source, extra) {
    var o = new PSObj('System.Management.Automation.CommandInfo', [['CommandType', type], ['Name', name], ['Version', version], ['Source', source]], { fmt: 'command' });
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function aliasObj(name, def) {
    var o = new PSObj('System.Management.Automation.AliasInfo', [['CommandType', 'Alias'], ['Name', name], ['Definition', def], ['ResolvedCommandName', def], ['Version', ''], ['Source', ''], ['DisplayName', name + ' -> ' + def]], { fmt: 'command', str: function () { return name; } });
    return o;
  }
  SPEC.gcm = { name: 'Get-Command', cls: CORE + 'GetCommandCommand', params: [val('Name', { pos: 0, arr: true, type: T_ARR }), val('Module', { arr: true, type: T_ARR }), sw('ListImported'), val('Verb', { arr: true, type: T_ARR }), val('Noun', { arr: true, type: T_ARR }),
    val('CommandType', { type: T_STR, al: ['Type'] }), sw('All'), sw('Syntax'), val('TotalCount', { type: 'System.Int32' })] };
  function allCommandInfos(S) {
    var out = [];
    Object.keys(ALIASES).forEach(function (k) { var a = ALIASES[k]; out.push(Object.assign(aliasObj(a.name, a.def), {})); });
    Object.keys(S.aliases || {}).forEach(function (k) { out.push(aliasObj(k, S.aliases[k])); });
    var seen = {};
    Object.keys(CMDS).forEach(function (k) {
      var d = CMDS[k];
      if (!d.spec || seen[d.spec.name]) return;
      seen[d.spec.name] = 1;
      var info = CMDLET_MODULE[d.spec.name.toLowerCase()];
      if (!info) return;
      out.push(cmdInfoObj(info.module === 'Microsoft.PowerShell.Archive' ? 'Function' : 'Cmdlet', d.spec.name, info.version, info.module));
    });
    NATIVE_NAMES.forEach(function (n) {
      var p = nativePath(n, S);
      if (!p) return;
      var base = p.slice(p.lastIndexOf('\\') + 1);
      out.push(cmdInfoObj('Application', base, '10.0.26100.6584', p));
    });
    return out;
  }
  function cmdGetCommand(ctx) {
    var P = ctx.p, S = ctx.session, status = 0, all = allCommandInfos(S);
    var types = P.CommandType ? String(P.CommandType).toLowerCase().split(',') : null;
    var names = P.Name ? P.Name : null, out = [];
    if (!names) names = ['*'];
    names.forEach(function (n) {
      if (n === null) return;
      var re = wildRegex(String(n));
      var hit = all.filter(function (o) { return re.test(strOf(o.get('Name'))) || (o.get('CommandType') === 'Application' && re.test(strOf(o.get('Name')).replace(/\.(exe|com|cmd)$/i, ''))); });
      if (types) hit = hit.filter(function (o) { return types.indexOf(String(o.get('CommandType')).toLowerCase()) >= 0; });
      if (!hit.length && !hasWild(String(n)) && !P.ListImported) {
        status = 1;
        ctx.fail({ msg: "無法辨識 '" + n + "' 詞彙是否為 Cmdlet、函數、指令檔或可執行程式的名稱。請檢查名稱拼字是否正確，如果包含路徑的話，請確認路徑是否正確，然後再試一次。", cat: 'ObjectNotFound', target: String(n), ttype: 'String', activity: 'Get-Command', reason: 'CommandNotFoundException', fq: 'CommandNotFoundException,' + CORE + 'GetCommandCommand' });
        return;
      }
      hit.forEach(function (o) { if (out.indexOf(o) < 0) out.push(o); });
    });
    var rank = { Alias: 0, Function: 1, Cmdlet: 2, Application: 3 };
    out.sort(function (a, b) { return (rank[a.get('CommandType')] - rank[b.get('CommandType')]) || ntfsCmp(strOf(a.get('Name')), strOf(b.get('Name'))); });
    if (P.TotalCount !== undefined) out = out.slice(0, Number(P.TotalCount));
    ctx.emit(out);
    return status;
  }
  SPEC.gal = { name: 'Get-Alias', cls: CORE + 'GetAliasCommand', params: [val('Name', { pos: 0, arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), val('Scope', { type: T_STR }), val('Definition', { arr: true, type: T_ARR })] };
  function cmdGetAlias(ctx) {
    var P = ctx.p, S = ctx.session, status = 0, rows = [];
    Object.keys(ALIASES).forEach(function (k) { rows.push(ALIASES[k]); });
    Object.keys(S.aliases).forEach(function (k) { rows.push({ name: k, def: S.aliases[k], version: '', source: '' }); });
    rows.sort(function (a, b) { return ntfsCmp(a.name, b.name); });
    var out = rows;
    if (P.Definition) { var dres = P.Definition.map(function (d) { return wildRegex(String(d)); }); out = rows.filter(function (r) { return dres.some(function (re) { return re.test(r.def); }); }); }
    else if (P.Name) {
      out = [];
      P.Name.forEach(function (n) {
        var re = wildRegex(String(n)), hit = rows.filter(function (r) { return re.test(r.name); });
        if (!hit.length && !hasWild(String(n))) { status = 1; ctx.fail({ msg: "因為具有 name '" + n + "' 的別名不存在，所以這個命令找不到相符的別名。", cat: 'ObjectNotFound', target: String(n), ttype: 'String', activity: 'Get-Alias', reason: 'ItemNotFoundException', fq: 'ItemNotFoundException,' + CORE + 'GetAliasCommand' }); return; }
        hit.forEach(function (r) { out.push(r); });
      });
    }
    ctx.emit(out.map(function (r) { var o = aliasObj(r.name, r.def); if (r.version) { o.set('Version', r.version); o.set('Source', r.source); } return o; }));
    return status;
  }

  /* ---- Get-Help (the form Windows PowerShell 5.1 prints when no help files are installed, plus our own -Examples) */
  var TYPE_SHORT = { 'System.String[]': 'string[]', 'System.String': 'string', 'System.Int32': 'int', 'System.Int64': 'long', 'System.UInt32': 'uint32', 'System.Object': 'Object', 'System.Object[]': 'Object[]', 'System.Boolean': 'bool', 'System.DateTime': 'datetime',
    'System.Char': 'char', 'System.Int32[]': 'int[]', 'System.Management.Automation.ScriptBlock': 'scriptblock', 'System.Management.Automation.ScriptBlock[]': 'scriptblock[]', 'System.Management.Automation.PSCredential': 'pscredential' };
  function typeShortName(t) { return t ? (hasOwn.call(TYPE_SHORT, t) ? TYPE_SHORT[t] : t.replace(/^.*\./, '')) : 'string'; }
  function syntaxOf(spec) {
    var ps = spec.params.filter(function (p) { return !p.dyn; });
    var pos = ps.filter(function (p) { return p.pos !== undefined && !p.sw; }).sort(function (a, b) { return a.pos - b.pos; });
    var named = ps.filter(function (p) { return p.pos === undefined || p.sw; });
    var parts = [];
    pos.forEach(function (p) { parts.push(p.mand ? '[-' + p.n + '] <' + typeShortName(p.type) + '>' : '[[-' + p.n + '] <' + typeShortName(p.type) + '>]'); });
    named.forEach(function (p) {
      if (p.sw) parts.push('[-' + p.n + ']');
      else parts.push(p.mand ? '-' + p.n + ' <' + typeShortName(p.type) + '>' : '[-' + p.n + ' <' + typeShortName(p.type) + '>]');
    });
    if (spec.risk) parts.push('[-WhatIf]', '[-Confirm]');
    return spec.name + ' ' + parts.join(' ') + '  [<CommonParameters>]';
  }
  var HELP_LINK = { 'get-childitem': 113308, 'get-content': 113310, 'get-date': 113313, 'get-item': 113319, 'get-location': 113321, 'get-process': 113324, 'get-service': 113332, 'set-location': 113397, 'new-item': 113353, 'remove-item': 113373,
    'copy-item': 113292, 'move-item': 113350, 'rename-item': 113382, 'select-object': 113387, 'sort-object': 113403, 'where-object': 113423, 'foreach-object': 113300, 'measure-object': 113349, 'group-object': 113338, 'import-csv': 113341,
    'export-csv': 113299, 'format-table': 113303, 'format-list': 113302, 'out-file': 113363, 'select-string': 113388, 'test-path': 113418, 'start-process': 113422, 'stop-process': 113412, 'get-command': 113309, 'get-help': 113316, 'get-alias': 113306, 'get-history': 113317 };
  var HELP_EXAMPLES = {
    'get-childitem': [['Get-ChildItem', '列出現在這個資料夾裡的東西（也可以寫成 ls、dir）。'], ['Get-ChildItem -Recurse -Filter *.csv', '連裡面的資料夾也找，只列出 .csv 檔。'], ['Get-ChildItem -Name', '只列出名字，不要表格。']],
    'set-location': [['Set-Location ~\\Desktop', '走到桌面（也可以寫成 cd）。'], ['Set-Location ..', '往外走一層。']],
    'get-content': [['Get-Content notes.txt', '顯示檔案內容（也可以寫成 cat）。'], ['Get-Content data\\A.csv -Head 5', '只看前 5 行。'], ['Get-Content notes.txt -Tail 3', '只看最後 3 行。']],
    'copy-item': [['Copy-Item notes.txt backup.txt', '複製一個檔案。'], ['Copy-Item data data2 -Recurse', '連同裡面的東西一起複製整個資料夾。']],
    'move-item': [['Move-Item week3.zip ~\\Desktop\\Project', '把檔案搬到另一個資料夾；目的地不存在時會變成改名。']],
    'remove-item': [['Remove-Item notes.txt', '刪除檔案（不會進資源回收筒）。'], ['Remove-Item data -Recurse', '刪除資料夾和裡面所有東西。']],
    'new-item': [['New-Item notes.txt -ItemType File', '建立空的文字檔。'], ['New-Item figures -ItemType Directory', '建立資料夾（也可以寫成 mkdir）。']],
    'get-date': [['Get-Date', '顯示現在的日期和時間。'], ['Get-Date -Format "yyyy-MM-dd"', '只顯示 2026-10-02 這種格式。']],
    'sort-object': [['Import-Csv data\\A.csv | Sort-Object score', '把成績依 score 排序（注意：CSV 讀進來都是文字，100 會排在 61 前面）。'], ['ls | Sort-Object Length -Descending', '依檔案大小從大排到小。']],
    'where-object': [['ls | Where-Object { $_.Length -gt 1000 }', '只留下大於 1000 位元組的檔案。'], ['Import-Csv data\\A.csv | Where-Object { [int]$_.score -ge 90 }', '先把 score 轉成數字再比，只留 90 分以上。']],
    'select-object': [['ls | Select-Object Name, Length', '只挑出 Name 和 Length 兩欄。'], ['Import-Csv data\\A.csv | Select-Object -Last 3', '只看最後 3 筆。']],
    'measure-object': [['Import-Csv data\\A.csv | Measure-Object score -Average', '算 score 的平均。'], ['Get-Content notes.txt | Measure-Object -Line -Word -Character', '算行數、字數、字元數。']],
    'group-object': [['ls | Group-Object Extension', '依副檔名分組，數每一組有幾個。']],
    'foreach-object': [['1..5 | ForEach-Object { $_ * 2 }', '每個數字乘以 2。'], ['ls | ForEach-Object { $_.Name }', '只印出每個檔案的名字。']],
    'select-string': [['Select-String -Path *.csv -Pattern "A00"', '在 .csv 檔裡找含有 A00 的行（類似 grep）。']],
    'import-csv': [['Import-Csv data\\A.csv', '把 CSV 讀進來，每一行變成一個物件。']],
    'export-csv': [['ls | Select-Object Name, Length | Export-Csv files.csv -NoTypeInformation', '把檔案清單存成 CSV。']],
    'get-process': [['Get-Process', '列出現在的處理序（程式）。'], ['Get-Process notepad', '只看記事本。']],
    'stop-process': [['Stop-Process -Name notepad', '把記事本關掉。']],
    'get-service': [['Get-Service', '列出 Windows 的服務。']],
    'out-file': [['ls | Out-File list.txt', '把 ls 的結果存成檔案（和 ls > list.txt 一樣）。']],
    'test-path': [['Test-Path notes.txt', '檢查檔案存不存在，回答 True 或 False。']],
    'start-process': [['Start-Process notepad', '開啟記事本。'], ['Start-Process https://example.com', '用 Edge 開網址。']],
    'compress-archive': [['Compress-Archive -Path data -DestinationPath data.zip', '把 data 資料夾壓縮成 data.zip。']],
    'expand-archive': [['Expand-Archive week3.zip -DestinationPath out', '把 zip 解壓縮到 out 資料夾。']],
    'get-filehash': [['Get-FileHash week3.zip', '算檔案的 SHA256 雜湊值（內容一樣，值就一樣）。']]
  };
  SPEC.gethelp = { name: 'Get-Help', cls: CORE + 'GetHelpCommand', params: [val('Name', { pos: 0, type: T_STR }), val('Path', { type: T_STR }), val('Category', { arr: true, type: T_ARR }), val('Component', { arr: true, type: T_ARR }),
    val('Functionality', { arr: true, type: T_ARR }), val('Role', { arr: true, type: T_ARR }), sw('Detailed'), sw('Full'), sw('Examples'), val('Parameter', { type: T_STR }), sw('Online'), sw('ShowWindow')] };
  function resolveHelpName(name, S) {
    var l = String(name).toLowerCase();
    if (hasOwn.call(ALIASES, l)) l = ALIASES[l].def.toLowerCase();
    if (S.aliases && hasOwn.call(S.aliases, l)) l = String(S.aliases[l]).toLowerCase();
    var d = hasOwn.call(CMDS, l) ? CMDS[l] : null;
    return d && d.spec ? d : null;
  }
  function aliasesOfCmdlet(full) { var out = []; Object.keys(ALIASES).forEach(function (k) { if (ALIASES[k].def.toLowerCase() === full.toLowerCase()) out.push(ALIASES[k].name); }); return out.sort(function (a, b) { return a.length - b.length || (a < b ? -1 : 1); }); }
  function cmdGetHelp(ctx) {
    var P = ctx.p, S = ctx.session;
    if (P.Name === undefined || P.Name === null) { ctx.out(HELP_TEXT); return 0; }
    var d = resolveHelpName(P.Name, S);
    if (!d && hasOwn.call(HELP_ONE, String(P.Name).toLowerCase())) { ctx.out('\n' + HELP_ONE[String(P.Name).toLowerCase()] + '\n\n'); return 0; }
    if (!d) {
      return ctx.fail({ msg: 'Get-Help 在此工作階段的說明檔中找不到 ' + P.Name + '。若要下載更新的說明主題，請輸入: "Update-Help"。若要線上取得說明，請搜尋 TechNet Library (網址為 https:/go.microsoft.com/fwlink/?LinkID=107116) 中的說明主題。',
        cat: 'ResourceUnavailable', target: '', activity: 'Get-Help', reason: 'HelpNotFoundException', fq: 'HelpNotFound,' + CORE + 'GetHelpCommand' });
    }
    var spec = d.spec, nm = spec.name, key = nm.toLowerCase();
    if (P.Online) {
      var url = 'https://learn.microsoft.com/powershell/module/' + (CMDLET_MODULE[key] ? CMDLET_MODULE[key].module.toLowerCase() : 'microsoft.powershell.core') + '/' + key;
      ctx.effect({ type: 'url', url: url });
      return 0;
    }
    var link = hasOwn.call(HELP_LINK, key) ? HELP_LINK[key] : 113316, al = aliasesOfCmdlet(nm);
    var lines = [''];
    lines.push('名稱', '    ' + nm, '    ');
    if (P.Examples && hasOwn.call(HELP_EXAMPLES, key)) {
      lines.push('範例');
      HELP_EXAMPLES[key].forEach(function (ex, i) {
        lines.push('    -------------------------- 範例 ' + (i + 1) + ' --------------------------', '', '    PS C:\\>' + ex[0], '    ', '    ' + ex[1], '    ');
      });
      lines.push('');
      ctx.out(lines.join('\n') + '\n');
      return 0;
    }
    lines.push('語法', '    ' + syntaxOf(spec), '    ', '');
    lines.push('別名', '    ' + (al.length ? al.join('\n    ') : '無'), '    ', '');
    lines.push('註解', '    Get-Help 在此電腦上找不到此 cmdlet 的說明檔案。它只顯示部分說明。', '        -- 若要下載並安裝包含此 cmdlet 之模組的說明檔案，請使用 Update-Help。',
      '        -- 若要線上檢視此 cmdlet 的說明主題，請輸入: "Get-Help ' + nm + ' -Online" 或', '           移至 https://go.microsoft.com/fwlink/?LinkID=' + link + '。');
    if (hasOwn.call(HELP_EXAMPLES, key)) lines.push('        -- 這個練習版另外附了範例，請輸入: "Get-Help ' + nm + ' -Examples"。');
    ctx.out(lines.join('\n') + '\n\n\n\n');
    return 0;
  }

  defCmd({ id: 'date', canon: 'unknown', spec: SPEC.date, run: cmdGetDate, nopaths: true }, ['Get-Date']);
  defCmd({ id: 'gps', canon: 'sys', spec: SPEC.gps, run: cmdGetProcess, nopaths: true }, ['Get-Process', 'gps', 'ps']);
  defCmd({ id: 'spps', canon: 'sys', spec: SPEC.spps, run: cmdStopProcess, nopaths: true }, ['Stop-Process', 'spps', 'kill']);
  defCmd({ id: 'gsv', canon: 'sys', spec: SPEC.gsv, run: cmdGetService, nopaths: true }, ['Get-Service', 'gsv']);
  defCmd({ id: 'gcinfo', canon: 'sys', spec: SPEC.gci2, run: cmdGetComputerInfo, nopaths: true }, ['Get-ComputerInfo', 'gin']);
  defCmd({ id: 'systeminfo', canon: 'sys', native: true, name: 'systeminfo', run: cmdSysteminfo, nopaths: true }, ['systeminfo']);
  defCmd({ id: 'tasklist', canon: 'sys', native: true, name: 'tasklist', run: cmdTasklist, nopaths: true }, ['tasklist']);
  defCmd({ id: 'taskkill', canon: 'sys', native: true, name: 'taskkill', run: cmdTaskkill, nopaths: true }, ['taskkill']);
  defCmd({ id: 'gcm', canon: 'help', spec: SPEC.gcm, run: cmdGetCommand, nopaths: true }, ['Get-Command', 'gcm']);
  defCmd({ id: 'gal', canon: 'help', spec: SPEC.gal, run: cmdGetAlias, nopaths: true }, ['Get-Alias', 'gal']);
  defCmd({ id: 'help', canon: 'help', spec: SPEC.gethelp, run: cmdGetHelp, nopaths: true }, ['Get-Help']);
  defCmd({ id: 'helpfn', canon: 'help', native: true, name: 'help', run: cmdHelp, nopaths: true }, ['help', 'man']);

  /* ====================================================================================================================
     Round 5 — network (all fake, nothing leaves the page): ipconfig, ping, Test-Connection, nslookup, tracert, Invoke-WebRequest / curl,
     Invoke-RestMethod, winget. Numbers follow SPEC section 1: Wi-Fi NTNU-Classroom, IPv4 10.20.31.57 / 255.255.255.0 / gateway 10.20.31.1 / DNS 10.20.0.53.
     ==================================================================================================================== */
  function sysInfo(key, dflt) {
    try { var i = LAB.sys && LAB.sys.info; if (i && i[key] !== undefined && i[key] !== null && i[key] !== '') return i[key]; } catch (e) { /* fall back */ }
    return dflt;
  }
  function macPlus(mac, n, firstXor) {
    var b = String(mac).split('-');
    if (b.length !== 6) return mac;
    var last = (parseInt(b[5], 16) + n) & 255;
    b[5] = ('0' + last.toString(16)).slice(-2).toUpperCase();
    if (firstXor) b[0] = ('0' + (parseInt(b[0], 16) ^ firstXor).toString(16)).slice(-2).toUpperCase();
    return b.join('-');
  }
  var NET = { ipv6: 'fe80::7c3e:9a1d:5b42:8e6f%12' };
  [['ip', 'IP', '10.20.31.57'], ['mask', 'MASK', '255.255.255.0'], ['gw', 'GATEWAY', '10.20.31.1'], ['dns', 'DNS', '10.20.0.53'], ['mac', 'MAC', 'A4-6B-B6-3E-91-C2'], ['adapter', 'ADAPTER', 'Intel(R) Wi-Fi 6E AX211 160MHz']].forEach(function (k) {
    Object.defineProperty(NET, k[0], { enumerable: true, get: function () { return sysInfo(k[1], k[2]); } });
  });
  function ipLine(label, value) { return '   ' + label + (value === undefined ? '' : value); }
  var L_ = {
    dnsSuffix: '連線特定 DNS 尾碼 . . . . . . . . : ', media: '媒體狀態 . . . . . . . . . . . . .: ', desc: '描述 . . . . . . . . . . . . . . .: ', mac: '實體位址 . . . . . . . . . . . . .: ',
    dhcp: 'DHCP 已啟用 . . . . . . . . . . . : ', auto: '自動設定啟用 . . . . . . . . . . .: ', ll6: '連結-本機 IPv6 位址 . . . . . . . : ', ip4: 'IPv4 位址 . . . . . . . . . . . . : ',
    mask: '子網路遮罩 . . . . . . . . . . . .: ', lease1: '租用取得 . . . . . . . . . . . . .: ', lease2: '租用到期 . . . . . . . . . . . . .: ', gw: '預設閘道 . . . . . . . . . . . . .: ',
    dhcpSrv: 'DHCP 伺服器 . . . . . . . . . . . : ', iaid: 'DHCPv6 IAID . . . . . . . . . . . : ', duid: 'DHCPv6 用戶端 DUID. . . . . . . . : ', dnsSrv: 'DNS 伺服器 . . . . . . . . . . . .: ', netbios: 'NetBIOS over Tcpip . . . . . . . .: '
  };
  function longDate(ms) { var d = new Date(ms); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + dLongTime(d); }
  function cmdIpconfig(ctx) {
    var args = ctx.rawArgs.map(function (a) { return String(a).toLowerCase(); }), all = args.indexOf('/all') >= 0;
    if (args.indexOf('/?') >= 0 || args.indexOf('-?') >= 0) {
      ctx.out('\n使用方式:\n    ipconfig [/allcompartments] [/? | /all |\n                                 /renew [adapter] | /release [adapter] |\n                                 /renew6 [adapter] | /release6 [adapter] |\n                                 /flushdns | /displaydns | /registerdns |\n                                 /showclassid adapter |\n                                 /setclassid adapter [classid] |\n                                 /showclassid6 adapter |\n                                 /setclassid6 adapter [classid] ]\n\n其中\n    adapter             連線名稱\n                       (允許萬用字元 * 和 ?，請參閱範例)\n');
      return 0;
    }
    if (args.indexOf('/flushdns') >= 0) { ctx.out('\nWindows IP 設定\n\n已成功清除 DNS 解析程式快取。\n'); return 0; }
    if (args.indexOf('/release') >= 0 || args.indexOf('/renew') >= 0) { ctx.native('\n作業失敗: 練習版的電腦不能重新取得 IP 位址。\n'); return 1; }
    var lines = ['', 'Windows IP 設定', ''];
    if (all) {
      lines.push(ipLine('主機名稱 . . . . . . . . . . . . .: ' + HOST), ipLine('主要 DNS 尾碼  . . . . . . . . . .: '), ipLine('節點類型 . . . . . . . . . . . . .: 混合式'), ipLine('IP 路由啟用 . . . . . . . . . . . : 否'), ipLine('WINS Proxy 啟用 . . . . . . . . . : 否'));
    }
    function down(name, kind, descr, mac) {
      lines.push('', kind + ' ' + name + ':', '');
      lines.push(ipLine(L_.media + '媒體已中斷連線'), ipLine(L_.dnsSuffix));
      if (all) lines.push(ipLine(L_.desc + descr), ipLine(L_.mac + mac), ipLine(L_.dhcp + '是'), ipLine(L_.auto + '是'));
    }
    down('區域連線* 1', '無線區域網路介面卡', 'Microsoft Wi-Fi Direct Virtual Adapter', macPlus(NET.mac, 1));
    down('區域連線* 2', '無線區域網路介面卡', 'Microsoft Wi-Fi Direct Virtual Adapter #2', macPlus(NET.mac, 0, 2));
    lines.push('', '無線區域網路介面卡 Wi-Fi:', '');
    lines.push(ipLine(L_.dnsSuffix));
    if (all) lines.push(ipLine(L_.desc + NET.adapter), ipLine(L_.mac + NET.mac), ipLine(L_.dhcp + '是'), ipLine(L_.auto + '是'));
    lines.push(ipLine(L_.ll6 + NET.ipv6 + (all ? '(偏好選項) ' : '')), ipLine(L_.ip4 + NET.ip + (all ? '(偏好選項) ' : '')), ipLine(L_.mask + NET.mask));
    if (all) lines.push(ipLine(L_.lease1 + longDate(new Date(2026, 9, 2, 8, 41, 7).getTime())), ipLine(L_.lease2 + longDate(new Date(2026, 9, 2, 10, 41, 6).getTime())));
    lines.push(ipLine(L_.gw + NET.gw));
    if (all) lines.push(ipLine(L_.dhcpSrv + NET.gw), ipLine(L_.iaid + '110520244'), ipLine(L_.duid + '00-01-00-01-30-8F-4C-21-' + NET.mac), ipLine(L_.dnsSrv + NET.dns), ipLine(L_.netbios + '啟用'));
    lines.push('', '乙太網路卡 藍牙網路連線:', '');
    lines.push(ipLine(L_.media + '媒體已中斷連線'), ipLine(L_.dnsSuffix));
    if (all) lines.push(ipLine(L_.desc + 'Bluetooth Device (Personal Area Network)'), ipLine(L_.mac + macPlus(NET.mac, 4)), ipLine(L_.dhcp + '是'), ipLine(L_.auto + '是'));
    ctx.out(lines.join('\n') + '\n');
    return 0;
  }

  /* ---- fake name resolution and latency */
  var KNOWN_HOSTS = { 'example.com': '93.184.216.34', 'www.example.com': '93.184.216.34', 'google.com': '142.250.185.78', 'www.google.com': '142.250.185.100', 'github.com': '20.27.177.113', 'ntnu.edu.tw': '140.122.64.22',
    'www.ntnu.edu.tw': '140.122.64.22', 'openai.com': '104.18.33.45', 'microsoft.com': '20.70.246.20', 'python.org': '151.101.0.223', 'www.python.org': '151.101.0.223', 'baidu.com': '110.242.68.66' };
  function hashIp(name) {
    var h = 5381;
    for (var i = 0; i < name.length; i++) h = ((h * 33) ^ name.charCodeAt(i)) >>> 0;
    return [93 + (h % 120), 1 + ((h >>> 8) % 250), 1 + ((h >>> 16) % 250), 1 + ((h >>> 24) % 250)].join('.');
  }
  /* -> {name, ip, ttl, ms (base latency), kind:'loop'|'lan'|'wan'|'dead'} or null when the name does not exist */
  function resolveHost(host) {
    var h = String(host).toLowerCase().replace(/\.$/, '');
    if (h === 'localhost') return { name: HOST, ip: '::1', ttl: 128, ms: 0, kind: 'loop6' };
    if (h === '127.0.0.1' || h === HOST.toLowerCase() || h === NET.ip) return { name: null, ip: h === HOST.toLowerCase() ? NET.ip : h, ttl: 128, ms: 0, kind: 'loop' };
    if (h === NET.gw) return { name: null, ip: h, ttl: 64, ms: 2, kind: 'lan' };
    if (h === NET.dns) return { name: null, ip: h, ttl: 64, ms: 3, kind: 'lan' };
    var m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
    if (m) {
      var a = +m[1], b = +m[2];
      if (+m[1] > 255 || +m[2] > 255 || +m[3] > 255 || +m[4] > 255) return null;
      if (a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b < 32) || a === 169) return { name: null, ip: h, ttl: 0, ms: 0, kind: 'dead' };
      return { name: null, ip: h, ttl: 117, ms: 13, kind: 'wan' };
    }
    if (hasOwn.call(KNOWN_HOSTS, h)) return { name: h, ip: KNOWN_HOSTS[h], ttl: 117, ms: 13, kind: 'wan' };
    if (h.indexOf('.') > 0 && /^[a-z0-9.-]+$/.test(h) && !/\.(invalid|test|example|localhost)$/.test(h)) return { name: h, ip: hashIp(h), ttl: 117, ms: 13, kind: 'wan' };
    return null;
  }
  function pingMs(r, i) { if (r.kind === 'loop' || r.kind === 'loop6') return 0; return r.ms + Math.floor(jitter(i + 7, r.ip.length * 13 + i) * (r.kind === 'wan' ? 5 : 2)); }
  function msText(ms, sep) { return ms === 0 ? '<1' + sep : ms + sep; }
  function* cmdPing(ctx) {
    var args = ctx.rawArgs.map(String), count = 4, forever = false, size = 32, wait = 4000, target = null;
    for (var i = 0; i < args.length; i++) {
      var a = args[i], al = a.toLowerCase();
      if (al === '-t' || al === '/t') forever = true;
      else if (al === '-n' || al === '/n') { var nv = args[++i]; if (!/^\d+$/.test(String(nv)) || +nv < 1 || +nv > 4294967295) { ctx.native('選項 -n 的值不正確，有效範圍是從 1 到 4294967295。\n'); return 1; } count = Math.min(100, +nv); }
      else if (al === '-l' || al === '/l') { var lv = args[++i]; if (!/^\d+$/.test(String(lv)) || +lv > 65500) { ctx.native('選項 -l 的值不正確，有效範圍是從 0 到 65500。\n'); return 1; } size = +lv; }
      else if (al === '-w' || al === '/w') wait = parseInt(args[++i], 10) || 4000;
      else if (al === '-i' || al === '-v' || al === '-s' || al === '-r' || al === '-j' || al === '-k' || al === '-S'.toLowerCase() || al === '-c') i++;
      else if (/^[-\/]\?$/.test(a)) { target = '?'; }
      else if (al === '-a' || al === '-f' || al === '-4' || al === '-6' || al === '-r' || al === '-p' || al === '/a' || al === '/f') { /* accepted */ }
      else if (a.charAt(0) === '-' && a.length > 1 && /^-[A-Za-z]$/.test(a)) { ctx.native('不正確的選項 ' + a + '。\n'); return 1; }
      else target = a;
    }
    if (target === '?') {
      ctx.out('\n使用方式: ping [-t] [-a] [-n count] [-l size] [-f] [-i TTL] [-v TOS]\n            [-r count] [-s count] [[-j host-list] | [-k host-list]]\n            [-w timeout] [-R] [-S srcaddr] [-c compartment] [-p]\n            [-4] [-6] target_name\n\n選項:\n    -t             Ping 指定的主機，直到停止。\n                   若要查看統計資料並繼續，請按 Control-Break;\n                   若要停止，請按 Control-C。\n    -a             將位址解析為主機名稱。\n    -n count       要傳送的回應要求數目。\n    -l size        傳送緩衝區大小。\n    -w timeout     每個回覆的等候逾時 (單位為毫秒)。\n    -4             強制使用 IPv4。\n    -6             強制使用 IPv6。\n');
      return 0;
    }
    if (target === null) { ctx.out('\n使用方式: ping [-t] [-a] [-n count] [-l size] [-f] [-i TTL] [-v TOS]\n            [-r count] [-s count] [[-j host-list] | [-k host-list]]\n            [-w timeout] [-R] [-S srcaddr] [-c compartment] [-p]\n            [-4] [-6] target_name\n'); return 1; }
    var r = resolveHost(target);
    if (!r) { ctx.out('Ping 要求找不到主機 ' + target + '。請檢查名稱，然候再試一次。\n'); return 1; }
    var shown = r.kind === 'loop6' ? 'Ping ' + r.name + ' [::1]' : (r.name && r.name !== r.ip ? 'Ping ' + target + ' [' + r.ip + ']' : 'Ping ' + r.ip);
    ctx.out('\n' + shown + ' (使用 ' + size + ' 位元組的資料):\n');
    var sent = 0, got = 0, times = [], done = false;
    try {
      while (sent < count || forever) {
        if (sent > 0) yield { sleep: r.kind === 'dead' ? 600 : 1000 };
        sent++;
        if (r.kind === 'dead') { ctx.out('要求等候逾時。\n'); continue; }
        var ms = pingMs(r, sent);
        got++; times.push(ms);
        if (r.kind === 'loop6') ctx.out('回覆自 ::1: 時間<1ms\n');
        else ctx.out('回覆自 ' + r.ip + ': 位元組=' + size + ' 時間' + (ms === 0 ? '<1ms' : '=' + ms + 'ms') + ' TTL=' + r.ttl + '\n');
      }
      done = true;
    } finally {
      var lost = sent - got;
      var stat = '\n' + r.ip + ' 的 Ping 統計資料:\n    封包: 已傳送 = ' + sent + '，已收到 = ' + got + ', 已遺失 = ' + lost + ' (' + Math.round(lost * 100 / Math.max(1, sent)) + '% 遺失)，\n';
      if (got) stat += '大約的來回時間 (毫秒):\n    最小值 = ' + Math.min.apply(null, times) + 'ms，最大值 = ' + Math.max.apply(null, times) + 'ms，平均 = ' + Math.round(times.reduce(function (x, y) { return x + y; }, 0) / got) + 'ms\n';
      ctx.out(stat);
      if (!done) ctx.out('Control-C\n');
    }
    return got ? 0 : 1;
  }

  SPEC.testconn = { name: 'Test-Connection', cls: CORE + 'TestConnectionCommand', params: [val('ComputerName', { pos: 0, mand: true, arr: true, type: T_ARR, al: ['CN', 'IPAddress', '__SERVER', 'Server', 'Destination'] }), val('Count', { type: 'System.Int32' }),
    val('BufferSize', { type: 'System.Int32', al: ['Size', 'Bytes', 'BS'] }), sw('Quiet'), val('Delay', { type: 'System.Int32' }), val('TimeToLive', { type: 'System.Int32', al: ['TTL'] }), sw('AsJob'), val('Source', { arr: true, type: T_ARR })] };
  function* cmdTestConnection(ctx) {
    var P = ctx.p, count = P.Count !== undefined ? Number(P.Count) : 4, status = 0, all = true;
    for (var ti = 0; ti < P.ComputerName.length; ti++) {
      var target = P.ComputerName[ti], r = resolveHost(target);
      if (!r) {
        status = 1;
        if (P.Quiet) { ctx.emitOne(false); continue; }
        ctx.fail({ msg: "測試與 '" + target + "' 電腦的連線失敗: 無法識別這台主機。", cat: 'ResourceUnavailable', target: target, ttype: 'String', activity: 'Test-Connection', reason: 'PingException', fq: 'TestConnectionException,' + CORE + 'TestConnectionCommand' });
        continue;
      }
      var oks = 0, rows = [];
      for (var i = 0; i < count; i++) {
        if (i > 0) yield { sleep: 600 };
        if (r.kind === 'dead') {
          continue;
        }
        oks++;
        rows.push(new PSObj('System.Management.ManagementObject#root\\cimv2\\Win32_PingStatus', [['Source', HOST], ['Destination', target], ['IPV4Address', r.ip.indexOf(':') >= 0 ? '127.0.0.1' : r.ip], ['IPV6Address', ''], ['Bytes', P.BufferSize ? Number(P.BufferSize) : 32], ['Time(ms)', pingMs(r, i + 1)]], { fmt: 'pingstatus' }));
      }
      if (P.Quiet) { ctx.emitOne(oks > 0); continue; }
      if (!oks) {
        status = 1;
        ctx.fail({ msg: "測試與 '" + target + "' 電腦的連線失敗: 要求等候逾時。", cat: 'ResourceUnavailable', target: target, ttype: 'String', activity: 'Test-Connection', reason: 'PingException', fq: 'TestConnectionException,' + CORE + 'TestConnectionCommand' });
        continue;
      }
      ctx.emit(rows);
    }
    return status;
  }
  SPECIAL_VIEWS.pingstatus = function (group) {
    var lines = ['Source        Destination     IPV4Address      IPV6Address                              Bytes    Time(ms) ', '------        -----------     -----------      -----------                              -----    -------- '];
    group.forEach(function (o) { lines.push(rtrim(padR(strOf(o.get('Source')), 14) + padR(strOf(o.get('Destination')), 16) + padR(strOf(o.get('IPV4Address')), 17) + padR(strOf(o.get('IPV6Address')), 41) + padR(strOf(o.get('Bytes')), 9) + strOf(o.get('Time(ms)')))); });
    return '\n' + lines.join('\n') + '\n\n\n';
  };

  function cmdNslookup(ctx) {
    var args = ctx.rawArgs.map(String).filter(function (a) { return a.charAt(0) !== '-' && a.charAt(0) !== '/'; });
    if (!args.length) { ctx.native('練習版的 nslookup 只能一次查一個名稱，例如 nslookup example.com。\n'); return 1; }
    var name = args[0], r = resolveHost(name);
    ctx.out('伺服器:  UnKnown\nAddress:  ' + NET.dns + '\n\n');
    if (!r || (r.kind === 'dead')) { ctx.native('*** UnKnown 找不到 ' + name + ': Non-existent domain\n'); return 1; }
    if (r.kind === 'loop6' || r.kind === 'loop') { ctx.out('名稱:    localhost\nAddresses:  ::1\n\t  127.0.0.1\n\n'); return 0; }
    if (!r.name) { ctx.out('名稱:    ' + (r.ip === NET.gw ? 'gateway.local' : 'host.local') + '\nAddress:  ' + r.ip + '\n\n'); return 0; }
    ctx.out('未經授權的回答:\n名稱:    ' + r.name + '\nAddress:  ' + r.ip + '\n\n');
    return 0;
  }

  function* cmdTracert(ctx) {
    var args = ctx.rawArgs.map(String), noName = false, maxHops = 30, target = null;
    for (var i = 0; i < args.length; i++) {
      var al = args[i].toLowerCase();
      if (al === '-d') noName = true; else if (al === '-h') maxHops = parseInt(args[++i], 10) || 30; else if (al === '-w' || al === '-j' || al === '-s' || al === '-R'.toLowerCase()) i++; else if (args[i].charAt(0) !== '-') target = args[i];
    }
    if (target === null) { ctx.out('\n使用方式: tracert [-d] [-h maximum_hops] [-j host-list] [-w timeout]\n               [-R] [-S srcaddr] [-4] [-6] target_name\n'); return 1; }
    var r = resolveHost(target);
    if (!r) { ctx.out('無法解析目標系統名稱 ' + target + '。\n'); return 1; }
    var named = r.name && r.name !== r.ip && !noName;
    ctx.out('\n' + (named ? '在上限 ' + maxHops + ' 個躍點上\n追蹤 ' + target + ' [' + r.ip + '] 的路由:\n' : '在上限 ' + maxHops + ' 個躍點上追蹤 ' + r.ip + ' 的路由\n') + '\n');
    var hops = r.kind === 'loop' || r.kind === 'loop6' ? [[0, r.ip]] : (r.kind === 'lan' ? [[2, r.ip]] : [[2, NET.gw], [3, '10.20.0.1'], [5, '203.64.100.1'], [7, '203.64.100.9'], [9, '211.72.10.1'], [null, null], [12, '168.95.0.1'], [r.ms + 1, r.ip]]);
    for (var h = 0; h < hops.length && h < maxHops; h++) {
      yield { sleep: 350 };
      var hp = hops[h], n = h + 1;
      if (hp[0] === null) { ctx.out(padL(String(n), 3) + '     *        *        *     要求等候逾時。\n'); continue; }
      var t = [0, 1, 2].map(function (k) { var v = hp[0] === 0 ? 0 : Math.max(1, hp[0] + Math.floor(jitter(n * 3 + k, n) * 3) - 1); return padL(v === 0 ? '<1 ms' : v + ' ms', 9); });
      ctx.out(padL(String(n), 3) + t.join('') + '  ' + hp[1] + ' \n');
    }
    ctx.out('\n追蹤完成。\n');
    return 0;
  }

  /* ---- web: Invoke-WebRequest (curl), Invoke-RestMethod, curl.exe */
  var EXAMPLE_HTML = '<!doctype html>\n<html>\n<head>\n    <title>Example Domain</title>\n\n    <meta charset="utf-8" />\n    <meta http-equiv="Content-type" content="text/html; charset=utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    '    <style type="text/css">\n    body {\n        background-color: #f0f0f2;\n        margin: 0;\n        padding: 0;\n        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;\n        \n    }\n' +
    '    div {\n        width: 600px;\n        margin: 5em auto;\n        padding: 2em;\n        background-color: #fdfdff;\n        border-radius: 0.5em;\n        box-shadow: 2px 3px 7px 2px rgba(0,0,0,0.02);\n    }\n    a:link, a:visited {\n        color: #38488f;\n        text-decoration: none;\n    }\n    @media (max-width: 700px) {\n        div {\n            margin: 0 auto;\n            width: auto;\n        }\n    }\n    </style>    \n</head>\n\n' +
    '<body>\n<div>\n    <h1>Example Domain</h1>\n    <p>This domain is for use in illustrative examples in documents. You may use this\n    domain in literature without prior coordination or asking for permission.</p>\n    <p><a href="https://www.iana.org/domains/example">More information...</a></p>\n</div>\n</body>\n</html>\n';
  function offlineHtml(url) {
    return '<!doctype html>\n<html>\n<head>\n    <meta charset="utf-8" />\n    <title>練習版範例網頁</title>\n</head>\n<body>\n    <h1>練習版範例網頁</h1>\n    <p>這台練習用的電腦不能上網，這是固定的假回應。</p>\n    <p>網址：' + url + '</p>\n</body>\n</html>\n';
  }
  function parseUrl(raw) {
    var u = String(raw).trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = 'http://' + u;
    var m = /^([a-z][a-z0-9+.-]*):\/\/([^\/?#:]*)(?::(\d+))?([^?#]*)(\?[^#]*)?/i.exec(u);
    if (!m) return null;
    return { url: u, scheme: m[1].toLowerCase(), host: m[2].toLowerCase(), path: m[4] || '/' };
  }
  function fakeWeb(url) {
    var pu = parseUrl(url);
    if (!pu) return null;
    var body = /(^|\.)example\.com$/.test(pu.host) ? EXAMPLE_HTML : offlineHtml(pu.url);
    var bytes = utf8Bytes(body).length;
    var isExample = /(^|\.)example\.com$/.test(pu.host);
    var headers = new PSHash([['Content-Length', String(bytes)], ['Cache-Control', 'max-age=604800'], ['Content-Type', 'text/html; charset=UTF-8'], ['Date', 'Fri, 02 Oct 2026 01:52:' + two(Math.floor(jitter(bytes, 3) * 59)) + ' GMT'], ['ETag', '"3147526947+ident"'], ['Server', 'ECS (sed/58A1)'], ['Accept-Ranges', 'bytes']]);
    return { pu: pu, body: body, bytes: bytes, isExample: isExample, headers: headers };
  }
  function webErr(ctx, activity, name, host) {
    return ctx.fail({ msg: '無法解析遠端名稱: \'' + host + '\'', cat: 'InvalidOperation', target: 'System.Net.HttpWebRequest', ttype: 'HttpWebRequest', activity: 'Invoke-WebRequest', reason: 'WebException', fq: 'WebCmdletWebResponseException,' + CORE + 'InvokeWebRequestCommand', head: name });
  }
  SPEC.iwr = { name: 'Invoke-WebRequest', cls: CORE + 'InvokeWebRequestCommand', params: [sw('UseBasicParsing'), val('Uri', { pos: 0, mand: true, type: T_STR }), val('Method', { type: T_STR }), val('Headers', { raw: true, type: T_OBJ }), val('Body', { raw: true, type: T_OBJ }),
    val('OutFile', { type: T_STR }), sw('PassThru'), val('ContentType', { type: T_STR }), val('TimeoutSec', { type: 'System.Int32' }), sw('UseDefaultCredentials'), val('UserAgent', { type: T_STR }), val('MaximumRedirection', { type: 'System.Int32' })] };
  function* cmdIwr(ctx) {
    var P = ctx.p, web = fakeWeb(P.Uri);
    yield { sleep: 350 };
    if (!web || (!resolveHost(web.pu.host) && web.pu.host !== '')) {
      return webErr(ctx, 'Invoke-WebRequest', ctx.name, web ? web.pu.host : P.Uri);
    }
    if (P.OutFile) {
      if (!writeToPath(ctx, P.OutFile, web.body, false, 'Invoke-WebRequest')) return 1;
      if (P.PassThru) ctx.emitOne(webResponseObj(web, !!P.UseBasicParsing));
      return 0;
    }
    ctx.emitOne(webResponseObj(web, !!P.UseBasicParsing));
    return 0;
  }
  function webResponseObj(web, basic) {
    var raw = 'HTTP/1.1 200 OK\r\n' + web.headers.keys.map(function (k) { return k + ': ' + web.headers.get(k); }).join('\r\n') + '\r\n\r\n' + web.body;
    var links = web.isExample ? [mkObj([['innerHTML', 'More information...'], ['innerText', 'More information...'], ['outerHTML', '<a href="https://www.iana.org/domains/example">More information...</a>'], ['outerText', 'More information...'], ['tagName', 'A'], ['href', 'https://www.iana.org/domains/example']], T_CUSTOM, { custom: true })] : [];
    var props = [['StatusCode', 200], ['StatusDescription', 'OK'], ['Content', web.body], ['RawContent', raw], ['Headers', web.headers]];
    if (!basic) props.push(['Images', []], ['InputFields', []], ['Links', links], ['ParsedHtml', 'mshtml.HTMLDocumentClass']);
    props.push(['RawContentLength', web.bytes]);
    if (!basic) props.push(['RelatedLinks', []]);
    return new PSObj(basic ? 'Microsoft.PowerShell.Commands.BasicHtmlWebResponseObject' : 'Microsoft.PowerShell.Commands.HtmlWebResponseObject', props, { custom: true, web: web });
  }
  SPEC.irm = { name: 'Invoke-RestMethod', cls: CORE + 'InvokeRestMethodCommand', params: [val('Uri', { pos: 0, mand: true, type: T_STR }), val('Method', { type: T_STR }), val('Headers', { raw: true, type: T_OBJ }), val('Body', { raw: true, type: T_OBJ }),
    val('OutFile', { type: T_STR }), val('ContentType', { type: T_STR }), val('TimeoutSec', { type: 'System.Int32' }), val('UserAgent', { type: T_STR })] };
  function* cmdIrm(ctx) {
    var P = ctx.p, web = fakeWeb(P.Uri);
    yield { sleep: 350 };
    if (!web || !resolveHost(web.pu.host)) return ctx.fail({ msg: '無法解析遠端名稱: \'' + (web ? web.pu.host : P.Uri) + '\'', cat: 'InvalidOperation', target: 'System.Net.HttpWebRequest', ttype: 'HttpWebRequest', activity: 'Invoke-RestMethod', reason: 'WebException', fq: 'WebCmdletWebResponseException,' + CORE + 'InvokeRestMethodCommand' });
    if (P.OutFile) { return writeToPath(ctx, P.OutFile, web.body, false, 'Invoke-RestMethod') ? 0 : 1; }
    if (web.isExample) ctx.emitOne(web.body);
    else ctx.emitOne(new PSObj(T_CUSTOM, [['ok', true], ['message', '練習版的固定回應'], ['url', web.pu.url], ['source', 'practice-pc']], { custom: true }));
    return 0;
  }
  function* cmdCurlExe(ctx) {
    var args = ctx.rawArgs.map(String), url = null, head = false, silent = false, outFile = null, remoteName = false, verbose = false;
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === '-I' || a === '--head') head = true; else if (a === '-s' || a === '--silent') silent = true; else if (a === '-o' || a === '--output') outFile = args[++i]; else if (a === '-O') remoteName = true;
      else if (a === '-L' || a === '--location' || a === '-k' || a === '-i' || a === '-f' || a === '-S') { /* accepted */ } else if (a === '-H' || a === '-X' || a === '-d' || a === '-A' || a === '--data') i++;
      else if (a === '-v') verbose = true;
      else if (/^--?[A-Za-z]/.test(a)) { /* unknown flags are ignored */ } else url = a;
    }
    if (url === null) { ctx.native('curl: try \'curl --help\' or \'curl --manual\' for more information\n'); return 2; }
    var web = fakeWeb(url);
    yield { sleep: 350 };
    if (!web || !resolveHost(web.pu.host)) { ctx.native('curl: (6) Could not resolve host: ' + (web ? web.pu.host : url) + '\n'); return 6; }
    var hdr = 'HTTP/1.1 200 OK\r\n' + web.headers.keys.map(function (k) { return k + ': ' + web.headers.get(k); }).join('\r\n') + '\r\n';
    if (head) { ctx.out(hdr.replace(/\r\n/g, '\n') + '\n'); return 0; }
    if (outFile || remoteName) {
      var fname = outFile || (web.pu.path.split('/').pop() || 'index.html');
      if (!writeToPath(ctx, fname, web.body, false, 'curl')) return 23;
      if (!silent) ctx.native('  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100 ' + padL(String(web.bytes), 5) + '  100 ' + padL(String(web.bytes), 5) + '    0     0  ' + padL(String(web.bytes * 70), 6) + '      0 --:--:-- --:--:-- --:--:-- ' + padL(String(web.bytes * 72), 6) + '\n');
      return 0;
    }
    ctx.out(web.body);
    return 0;
  }

  /* ---- winget */
  var PACKAGES = { 'git.git': { name: 'Git', id: 'Git.Git', ver: '2.51.0', url: 'https://github.com/git-for-windows/git/releases/download/v2.51.0.windows.1/Git-2.51.0-64-bit.exe', mb: '65.4', key: 'git' },
    'python.python.3.12': { name: 'Python 3.12', id: 'Python.Python.3.12', ver: '3.12.10', url: 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe', mb: '25.7', key: 'python' } };
  function findPackage(q) {
    var l = String(q).toLowerCase();
    if (hasOwn.call(PACKAGES, l)) return PACKAGES[l];
    if (l === 'git') return PACKAGES['git.git'];
    if (l === 'python' || l === 'python3' || l === 'python.python.3' || l === 'python.python.3.12') return PACKAGES['python.python.3.12'];
    return null;
  }
  var WINGET_VER = 'v1.29.380';
  function* cmdWinget(ctx) {
    var args = ctx.rawArgs.map(String), sub = args[0] ? args[0].toLowerCase() : '';
    if (sub === '--version' || sub === '-v') { ctx.out(WINGET_VER + '\n'); return 0; }
    if (sub === '' || sub === '--help' || sub === '-?') {
      ctx.out('Windows 封裝管理員 ' + WINGET_VER + '\nCopyright (c) Microsoft Corporation. 著作權所有，並保留一切權利。\n\nWindows 封裝管理員命令列公用程式可讓您從命令列安裝應用程式和其他封裝。\n\n使用方式: winget [<命令>] [<選項>]\n\n下列命令可用:\n  install    安裝指定的封裝\n  show       顯示封裝的相關資訊\n  search     搜尋封裝的基本資訊\n  list       顯示已安裝的封裝\n  upgrade    顯示並執行可用的升級\n  uninstall  解除安裝指定的封裝\n\n如需特定命令的詳細資訊，請將說明引數傳遞給命令。 [-?]\n');
      return 0;
    }
    var rest = args.slice(1), query = null;
    for (var i = 0; i < rest.length; i++) {
      var a = rest[i], al = a.toLowerCase();
      if (al === '--id' || al === '--name' || al === '-q' || al === '--query') query = rest[++i];
      else if (al === '-s' || al === '--source' || al === '-v' || al === '--version' || al === '--scope' || al === '-l' || al === '--location') i++;
      else if (a.charAt(0) !== '-') query = query === null ? a : query;
    }
    if (sub === 'list' || sub === 'ls') {
      var rows = [['Windows Terminal', 'Microsoft.WindowsTerminal', '1.24.12741.0', 'winget'], ['Microsoft Edge', 'Microsoft.Edge', '141.0.3537.57', 'winget'], ['Visual Studio Code', 'Microsoft.VisualStudioCode', '1.104.3', 'winget']];
      if (termState.installed.git) rows.push(['Git', 'Git.Git', PACKAGES['git.git'].ver, 'winget']);
      if (termState.installed.python) rows.push(['Python 3.12', 'Python.Python.3.12', PACKAGES['python.python.3.12'].ver, 'winget']);
      var cols = [{ h: '名稱', cells: rows.map(function (r) { return r[0]; }), right: false }, { h: '識別碼', cells: rows.map(function (r) { return r[1]; }), right: false }, { h: '版本', cells: rows.map(function (r) { return r[2]; }), right: false }, { h: '來源', cells: rows.map(function (r) { return r[3]; }), right: false }];
      var lines = tableLinesOf(cols, ctx.cols);
      lines.splice(1, 1, new Array(Math.min(ctx.cols - 1, Math.max.apply(null, lines.map(displayWidth))) + 1).join('-'));
      ctx.out(lines.join('\n') + '\n');
      return 0;
    }
    if (sub === 'search' || sub === 'show') {
      var pk = query ? findPackage(query) : null;
      if (!pk) { ctx.out('找不到符合輸入準則的封裝。\n'); return 1; }
      if (sub === 'show') { ctx.out('找到 ' + pk.name + ' [' + pk.id + ']\n版本: ' + pk.ver + '\n發行者: ' + (pk.key === 'git' ? 'The Git Development Community' : 'Python Software Foundation') + '\n'); return 0; }
      var c2 = [{ h: '名稱', cells: [pk.name], right: false }, { h: '識別碼', cells: [pk.id], right: false }, { h: '版本', cells: [pk.ver], right: false }, { h: '來源', cells: ['winget'], right: false }];
      var l2 = tableLinesOf(c2, ctx.cols);
      l2.splice(1, 1, new Array(Math.min(ctx.cols - 1, Math.max.apply(null, l2.map(displayWidth))) + 1).join('-'));
      ctx.out(l2.join('\n') + '\n');
      return 0;
    }
    if (sub === 'install' || sub === 'add') {
      var pkg = query ? findPackage(query) : null;
      if (!query) { ctx.native('必須提供要安裝的封裝名稱或識別碼。\n'); return 1; }
      if (!pkg) { ctx.out('找不到符合輸入準則的封裝。\n'); return 1; }
      if (termState.installed[pkg.key]) { ctx.out('已安裝現有的封裝。正在嘗試升級已安裝的封裝...\n找不到可用的升級。\n'); return 0; }
      ctx.out('找到 ' + pkg.name + ' [' + pkg.id + '] 版本 ' + pkg.ver + '\n此應用程式由其擁有者授權予您。\nMicrosoft 不負責，也不會授予第三方封裝的任何授權。\n正在下載 ' + pkg.url + '\n');
      yield { sleep: 1100 };
      ctx.out('  ██████████████████████████████  ' + pkg.mb + ' MB / ' + pkg.mb + ' MB\n已成功驗證安裝程式雜湊\n正在開始安裝封裝...\n');
      yield { sleep: 1300 };
      termState.installed[pkg.key] = true;
      ctx.out('已成功安裝\n');
      return 0;
    }
    if (sub === 'uninstall' || sub === 'remove' || sub === 'rm') {
      var pk2 = query ? findPackage(query) : null;
      if (!pk2 || !termState.installed[pk2.key]) { ctx.out('找不到與輸入準則相符的已安裝封裝。\n'); return 1; }
      ctx.out('找到 ' + pk2.name + ' [' + pk2.id + ']\n正在開始解除安裝封裝...\n');
      yield { sleep: 900 };
      termState.installed[pk2.key] = false;
      ctx.out('已成功解除安裝\n');
      return 0;
    }
    if (sub === 'upgrade' || sub === 'update') { ctx.out('找不到可用的升級。\n'); return 0; }
    ctx.native('練習版的 winget 只做 install、list、search、show、uninstall。\n');
    return 1;
  }

  defCmd({ id: 'ipconfig', canon: 'net', native: true, name: 'ipconfig', run: cmdIpconfig, nopaths: true }, ['ipconfig']);
  defCmd({ id: 'ping', canon: 'net', native: true, name: 'ping', run: cmdPing, nopaths: true }, ['ping']);
  defCmd({ id: 'testconn', canon: 'net', spec: SPEC.testconn, run: cmdTestConnection, nopaths: true }, ['Test-Connection']);
  defCmd({ id: 'nslookup', canon: 'net', native: true, name: 'nslookup', run: cmdNslookup, nopaths: true }, ['nslookup']);
  defCmd({ id: 'tracert', canon: 'net', native: true, name: 'tracert', run: cmdTracert, nopaths: true }, ['tracert']);
  defCmd({ id: 'iwr', canon: 'net', spec: SPEC.iwr, run: cmdIwr, nopaths: true }, ['Invoke-WebRequest', 'iwr', 'curl', 'wget']);
  defCmd({ id: 'irm', canon: 'net', spec: SPEC.irm, run: cmdIrm, nopaths: true }, ['Invoke-RestMethod', 'irm']);
  defCmd({ id: 'curlexe', canon: 'net', native: true, name: 'curl.exe', run: cmdCurlExe, nopaths: true }, ['curl.exe']);
  defCmd({ id: 'winget', canon: 'pkg', native: true, name: 'winget', run: cmdWinget, nopaths: true }, ['winget']);

  /* ====================================================================================================================
     Round 5 — a fresh PC: python is only the Microsoft Store stub and git is not installed until `winget install` runs (SPEC section 1).
     After that: a small git (init, status, add, commit, log, branch, switch, diff, config) that works on the real files of the VFS,
     and a small python (REPL, -c, scripts that only print and calculate).
     ==================================================================================================================== */
  var STORE_MSG = 'Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings > Apps > Advanced app settings > App execution aliases.';
  var PY_VER = '3.12.10';

  /* ---- python: expressions, print(), variables */
  function PyFloat(v) { this.pyfloat = true; this.v = v; }
  function isPyFloat(x) { return x instanceof PyFloat; }
  function pyErrObj(kind, msg) { var e = new Error(msg); e.pyerr = { kind: kind, msg: msg }; return e; }
  function pyTokens(src) {
    var toks = [], i = 0, n = src.length, m;
    while (i < n) {
      var c = src.charAt(i);
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '#') break;
      if ((m = /^(?:\d+\.\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?|\d+[eE][-+]?\d+|\d[\d_]*)/.exec(src.slice(i)))) { toks.push({ t: 'num', v: m[0].replace(/_/g, ''), at: i }); i += m[0].length; continue; }
      if (/[A-Za-z_]/.test(c) || c.charCodeAt(0) > 127 && !/[\u3000-\u303f\uff00-\uffef]/.test(c)) {
        m = /^[A-Za-z_\u0080-\uffff][\w\u0080-\uffff]*/.exec(src.slice(i));
        // an f-string / r-string prefix
        if (/^[fFrRbBuU]{1,2}$/.test(m[0]) && /["']/.test(src.charAt(i + m[0].length))) { var pre = m[0].toLowerCase(); i += m[0].length; var q0 = src.charAt(i), j0 = i + 1, s0 = ''; while (j0 < n && src.charAt(j0) !== q0) { if (src.charAt(j0) === '\\' && pre.indexOf('r') < 0) { var e0 = src.charAt(j0 + 1); s0 += e0 === 'n' ? '\n' : (e0 === 't' ? '\t' : e0); j0 += 2; continue; } s0 += src.charAt(j0++); } if (j0 >= n) throw pyErrObj('SyntaxError', 'unterminated string literal (detected at line 1)'); toks.push({ t: 'str', v: s0, f: pre.indexOf('f') >= 0, at: i }); i = j0 + 1; continue; }
        toks.push({ t: 'name', v: m[0], at: i }); i += m[0].length; continue;
      }
      if (c === '"' || c === "'") {
        var q = c, j = i + 1, s = '';
        while (j < n && src.charAt(j) !== q) { if (src.charAt(j) === '\\') { var e = src.charAt(j + 1); s += e === 'n' ? '\n' : (e === 't' ? '\t' : (e === '\\' ? '\\' : e)); j += 2; continue; } s += src.charAt(j++); }
        if (j >= n) throw pyErrObj('SyntaxError', 'unterminated string literal (detected at line 1)');
        toks.push({ t: 'str', v: s, at: i }); i = j + 1; continue;
      }
      if ((m = /^(\*\*=|\/\/=|\*\*|\/\/|==|!=|<=|>=|\+=|-=|\*=|\/=|%=|[-+*\/%()<>=,.\[\]:{}])/.exec(src.slice(i)))) { toks.push({ t: 'op', v: m[0], at: i }); i += m[0].length; continue; }
      throw pyErrObj('SyntaxError', 'invalid character \'' + c + '\' (U+' + ('0000' + c.charCodeAt(0).toString(16).toUpperCase()).slice(-4) + ')');
    }
    return toks;
  }
  function pyStr(v) {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (isPyFloat(v)) { var x = v.v; if (x === Infinity) return 'inf'; if (x === -Infinity) return '-inf'; if (x !== x) return 'nan'; var s = String(x); if (/e/.test(s)) s = s.replace(/e([+-])(\d)$/, 'e$10$2'); return Number.isInteger(x) && Math.abs(x) < 1e16 ? x.toFixed(1) : s; }
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return '[' + v.map(pyRepr).join(', ') + ']';
    if (v && v.tuple) return '(' + v.tuple.map(pyRepr).join(', ') + (v.tuple.length === 1 ? ',' : '') + ')';
    return String(v);
  }
  function pyRepr(v) { return typeof v === 'string' ? (v.indexOf("'") >= 0 && v.indexOf('"') < 0 ? '"' + v + '"' : "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'") : pyStr(v); }
  function pyNum(v) { return isPyFloat(v) ? v.v : (typeof v === 'boolean' ? (v ? 1 : 0) : v); }
  function pyIsNum(v) { return typeof v === 'number' || isPyFloat(v) || typeof v === 'boolean'; }
  function pyTrue(v) { return !(v === null || v === false || v === 0 || v === '' || (isPyFloat(v) && v.v === 0) || (Array.isArray(v) && !v.length)); }
  function pyTypeName(v) { return v === null ? 'NoneType' : (typeof v === 'string' ? 'str' : (typeof v === 'boolean' ? 'bool' : (isPyFloat(v) ? 'float' : (typeof v === 'number' ? 'int' : (Array.isArray(v) ? 'list' : (v && v.tuple ? 'tuple' : 'object')))))); }
  function pyEvalLine(src, env, out) {
    var toks = pyTokens(src), p = 0;
    function peek() { return toks[p]; }
    function isOp(v) { return toks[p] && toks[p].t === 'op' && toks[p].v === v; }
    function isName(v) { return toks[p] && toks[p].t === 'name' && toks[p].v === v; }
    function syntax() { throw pyErrObj('SyntaxError', 'invalid syntax'); }
    function expect(v) { if (!isOp(v)) syntax(); p++; }
    function mk(v) { return v; }
    function numResult(isF, x) { return isF ? new PyFloat(x) : x; }
    function arith(op, a, b) {
      if (op === '+') { if (typeof a === 'string' && typeof b === 'string') return a + b; if (Array.isArray(a) && Array.isArray(b)) return a.concat(b); }
      if (op === '*') { if (typeof a === 'string' && typeof b === 'number') return new Array(Math.max(0, b) + 1).join(a); if (typeof b === 'string' && typeof a === 'number') return new Array(Math.max(0, a) + 1).join(b); if (Array.isArray(a) && typeof b === 'number') { var r0 = []; for (var k = 0; k < b; k++) r0 = r0.concat(a); return r0; } }
      if (!pyIsNum(a) || !pyIsNum(b)) throw pyErrObj('TypeError', "unsupported operand type(s) for " + op + ": '" + pyTypeName(a) + "' and '" + pyTypeName(b) + "'");
      var x = pyNum(a), y = pyNum(b), f = isPyFloat(a) || isPyFloat(b);
      switch (op) {
        case '+': return numResult(f, x + y); case '-': return numResult(f, x - y); case '*': return numResult(f, x * y);
        case '/': if (y === 0) throw pyErrObj('ZeroDivisionError', 'division by zero'); return new PyFloat(x / y);
        case '//': if (y === 0) throw pyErrObj('ZeroDivisionError', f ? 'float floor division by zero' : 'integer division or modulo by zero'); return numResult(f, Math.floor(x / y));
        case '%': if (y === 0) throw pyErrObj('ZeroDivisionError', f ? 'float modulo' : 'integer modulo by zero'); return numResult(f, x - Math.floor(x / y) * y);
        case '**': { var rr = Math.pow(x, y); return numResult(f || y < 0, rr); }
      }
      return null;
    }
    function cmp(op, a, b) {
      if (op === '==') return pyEq(a, b); if (op === '!=') return !pyEq(a, b);
      var x = pyIsNum(a) ? pyNum(a) : a, y = pyIsNum(b) ? pyNum(b) : b;
      if ((typeof x === 'number') !== (typeof y === 'number') && !(typeof x === 'string' && typeof y === 'string')) throw pyErrObj('TypeError', "'" + op + "' not supported between instances of '" + pyTypeName(a) + "' and '" + pyTypeName(b) + "'");
      return op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
    }
    function pyEq(a, b) { if (pyIsNum(a) && pyIsNum(b)) return pyNum(a) === pyNum(b); if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(function (x, i) { return pyEq(x, b[i]); }); return a === b; }
    function expr() { return orE(); }
    function orE() { var l = andE(); while (isName('or')) { p++; var r = andE(); l = pyTrue(l) ? l : r; } return l; }
    function andE() { var l = notE(); while (isName('and')) { p++; var r = notE(); l = pyTrue(l) ? r : l; } return l; }
    function notE() { if (isName('not')) { p++; return !pyTrue(notE()); } return cmpE(); }
    function cmpE() {
      var l = addE();
      for (;;) {
        var t = peek();
        if (t && t.t === 'op' && /^(==|!=|<=|>=|<|>)$/.test(t.v)) { p++; l = cmp(t.v, l, addE()); continue; }
        if (isName('in')) { p++; var c = addE(); l = typeof c === 'string' ? c.indexOf(l) >= 0 : (Array.isArray(c) && c.some(function (x) { return pyEq(x, l); })); continue; }
        if (isName('is')) { p++; var neg = false; if (isName('not')) { p++; neg = true; } var r = addE(); l = (l === r) !== neg; continue; }
        return l;
      }
    }
    function addE() { var l = mulE(); while (isOp('+') || isOp('-')) { var op = toks[p++].v; l = arith(op, l, mulE()); } return l; }
    function mulE() { var l = unE(); while (isOp('*') || isOp('/') || isOp('//') || isOp('%')) { var op = toks[p++].v; l = arith(op, l, unE()); } return l; }
    function unE() { if (isOp('-')) { p++; var v = unE(); if (!pyIsNum(v)) throw pyErrObj('TypeError', "bad operand type for unary -: '" + pyTypeName(v) + "'"); return isPyFloat(v) ? new PyFloat(-v.v) : -pyNum(v); } if (isOp('+')) { p++; return unE(); } return powE(); }
    function powE() { var b = postE(); if (isOp('**')) { p++; var e = unE(); return arith('**', b, e); } return b; }
    function postE() {
      var v = atom();
      for (;;) {
        if (isOp('(')) { p++; var args = []; if (!isOp(')')) { for (;;) { args.push(expr()); if (isOp(',')) { p++; if (isOp(')')) break; continue; } break; } } expect(')'); v = callPy(v, args); continue; }
        if (isOp('[')) { p++; var ix = expr(); expect(']'); v = pyIndex(v, ix); continue; }
        if (isOp('.')) { p++; var nm = peek(); if (!nm || nm.t !== 'name') syntax(); p++; v = { bound: v, name: nm.v }; continue; }
        return v;
      }
    }
    function pyIndex(v, ix) {
      if (typeof ix !== 'number') throw pyErrObj('TypeError', 'indices must be integers or slices, not ' + pyTypeName(ix));
      var arr = typeof v === 'string' ? v : (Array.isArray(v) ? v : (v && v.tuple ? v.tuple : null));
      if (arr === null) throw pyErrObj('TypeError', "'" + pyTypeName(v) + "' object is not subscriptable");
      var k = ix < 0 ? ix + arr.length : ix;
      if (k < 0 || k >= arr.length) throw pyErrObj('IndexError', (typeof v === 'string' ? 'string' : (Array.isArray(v) ? 'list' : 'tuple')) + ' index out of range');
      return typeof v === 'string' ? v.charAt(k) : arr[k];
    }
    function atom() {
      var t = peek();
      if (!t) syntax();
      if (t.t === 'num') { p++; return /[.eE]/.test(t.v) ? new PyFloat(parseFloat(t.v)) : parseInt(t.v, 10); }
      if (t.t === 'str') {
        p++;
        var s = t.v;
        if (t.f) s = s.replace(/\{\{|\}\}|\{([^{}]*)\}/g, function (m0, inner) { if (m0 === '{{') return '{'; if (m0 === '}}') return '}'; var name = inner.split(':')[0].trim(); var spec = inner.indexOf(':') >= 0 ? inner.slice(inner.indexOf(':') + 1) : ''; var val = pyEvalLine(name, env, out).value; return fmtSpec(val, spec); });
        while (peek() && peek().t === 'str') { s += peek().v; p++; }
        return s;
      }
      if (t.t === 'name') {
        p++;
        if (t.v === 'True') return true; if (t.v === 'False') return false; if (t.v === 'None') return null;
        if (hasOwn.call(env.vars, t.v)) return env.vars[t.v];
        if (hasOwn.call(PY_BUILTINS, t.v)) return { builtin: t.v };
        throw pyErrObj('NameError', "name '" + t.v + "' is not defined");
      }
      if (isOp('(')) {
        p++;
        if (isOp(')')) { p++; return { tuple: [] }; }
        var first = expr();
        if (isOp(',')) { var items = [first]; while (isOp(',')) { p++; if (isOp(')')) break; items.push(expr()); } expect(')'); return { tuple: items }; }
        expect(')');
        return first;
      }
      if (isOp('[')) { p++; var list = []; if (!isOp(']')) { for (;;) { list.push(expr()); if (isOp(',')) { p++; if (isOp(']')) break; continue; } break; } } expect(']'); return list; }
      syntax();
      return null;
    }
    function fmtSpec(v, spec) {
      var m = /^(?:\.(\d+))?([fdsx%]?)$/.exec(spec || '');
      if (!spec) return pyStr(v);
      if (!m) return pyStr(v);
      var num = pyNum(v);
      if (m[2] === 'f' || (m[1] !== undefined && m[2] === '')) return Number(num).toFixed(m[1] === undefined ? 6 : +m[1]);
      if (m[2] === '%') return (num * 100).toFixed(m[1] === undefined ? 6 : +m[1]) + '%';
      return pyStr(v);
    }
    function callPy(f, args) {
      if (f && f.bound !== undefined) return pyMethod(f.bound, f.name, args);
      if (f && f.builtin) return PY_BUILTINS[f.builtin](args, env, out);
      throw pyErrObj('TypeError', "'" + pyTypeName(f) + "' object is not callable");
    }
    function pyMethod(o, name, args) {
      if (typeof o === 'string') {
        switch (name) {
          case 'upper': return o.toUpperCase(); case 'lower': return o.toLowerCase(); case 'strip': return o.trim(); case 'title': return o.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
          case 'replace': return o.split(pyStr(args[0])).join(pyStr(args[1])); case 'split': return args.length ? o.split(pyStr(args[0])) : o.trim().split(/\s+/);
          case 'startswith': return o.indexOf(pyStr(args[0])) === 0; case 'endswith': return o.slice(o.length - pyStr(args[0]).length) === pyStr(args[0]);
          case 'join': return (Array.isArray(args[0]) ? args[0] : []).map(pyStr).join(o); case 'format': { var k = 0; return o.replace(/\{\}/g, function () { return pyStr(args[k++]); }); }
        }
      }
      if (Array.isArray(o)) { if (name === 'append') { o.push(args[0]); return null; } if (name === 'pop') return o.pop(); if (name === 'sort') { o.sort(function (a, b) { return pyNum(a) < pyNum(b) ? -1 : pyNum(a) > pyNum(b) ? 1 : 0; }); return null; } if (name === 'reverse') { o.reverse(); return null; } }
      throw pyErrObj('AttributeError', "'" + pyTypeName(o) + "' object has no attribute '" + name + "'");
    }
    var PY_BUILTINS = {
      print: function (args, e, o) { var sep = ' ', end = '\n', list = []; args.forEach(function (a) { list.push(a); }); o.push(list.map(pyStr).join(sep) + end); return null; },
      len: function (a) { var v = a[0]; if (typeof v === 'string' || Array.isArray(v)) return v.length; if (v && v.tuple) return v.tuple.length; throw pyErrObj('TypeError', "object of type '" + pyTypeName(v) + "' has no len()"); },
      str: function (a) { return a.length ? pyStr(a[0]) : ''; }, repr: function (a) { return pyRepr(a[0]); },
      int: function (a) { var v = a[0]; if (typeof v === 'string') { if (!/^\s*[-+]?\d+\s*$/.test(v)) throw pyErrObj('ValueError', "invalid literal for int() with base 10: " + pyRepr(v)); return parseInt(v, 10); } return Math.trunc(pyNum(v)); },
      float: function (a) { var v = a[0]; if (typeof v === 'string') { if (!/^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(v)) throw pyErrObj('ValueError', 'could not convert string to float: ' + pyRepr(v)); return new PyFloat(parseFloat(v)); } return new PyFloat(pyNum(v)); },
      round: function (a) { var x = pyNum(a[0]); if (a.length > 1) { var f = Math.pow(10, a[1]); return new PyFloat(roundEven(x * f) / f); } return roundEven(x); },
      abs: function (a) { var v = a[0]; return isPyFloat(v) ? new PyFloat(Math.abs(v.v)) : Math.abs(pyNum(v)); },
      max: function (a) { var l = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return l.reduce(function (m, x) { return pyNum(x) > pyNum(m) ? x : m; }); },
      min: function (a) { var l = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return l.reduce(function (m, x) { return pyNum(x) < pyNum(m) ? x : m; }); },
      sum: function (a) { var l = a[0] || [], f = l.some(isPyFloat), t = l.reduce(function (s, x) { return s + pyNum(x); }, 0); return f ? new PyFloat(t) : t; },
      sorted: function (a) { return a[0].slice().sort(function (x, y) { return pyNum(x) < pyNum(y) ? -1 : pyNum(x) > pyNum(y) ? 1 : 0; }); },
      range: function (a) { var s = 0, e = pyNum(a[0]), st = 1; if (a.length > 1) { s = pyNum(a[0]); e = pyNum(a[1]); } if (a.length > 2) st = pyNum(a[2]); var r = []; for (var i = s; st > 0 ? i < e : i > e; i += st) { r.push(i); if (r.length > 100000) break; } return r; },
      list: function (a) { var v = a[0]; return v === undefined ? [] : (typeof v === 'string' ? Array.from(v) : (v && v.tuple ? v.tuple.slice() : v.slice())); },
      type: function (a) { return { cls: pyTypeName(a[0]) }; },
      bool: function (a) { return pyTrue(a[0]); },
      input: function () { throw pyErrObj('EOFError', 'EOF when reading a line'); },
      exit: function () { throw { pyexit: true }; }, quit: function () { throw { pyexit: true }; }
    };
    // a statement: name = expr, name += expr, or an expression
    if (toks.length >= 2 && toks[0].t === 'name' && toks[1].t === 'op' && /^(=|\+=|-=|\*=|\/=|\/\/=|%=|\*\*=)$/.test(toks[1].v) && !(toks[1].v === '=' && toks[2] && toks[2].v === '=')) {
      var nm = toks[0].v, op = toks[1].v;
      p = 2;
      var v = expr();
      if (p < toks.length) syntax();
      if (op !== '=') { if (!hasOwn.call(env.vars, nm)) throw pyErrObj('NameError', "name '" + nm + "' is not defined"); v = arith(op.slice(0, -1), env.vars[nm], v); }
      env.vars[nm] = v;
      return { value: undefined, assigned: true };
    }
    if (!toks.length) return { value: undefined, empty: true };
    var val = expr();
    if (p < toks.length) syntax();
    return { value: val };
  }
  function pyReport(ctx, e, where, lineText, lineNo) {
    if (e && e.pyexit) return 'exit';
    if (!e || !e.pyerr) throw e;
    var err = e.pyerr;
    if (err.kind === 'SyntaxError') ctx.err('  File "' + where + '", line ' + lineNo + '\n    ' + lineText.trim() + '\n    ' + '^'.repeat(Math.max(1, Math.min(lineText.trim().length, 1))) + '\nSyntaxError: ' + err.msg + '\n');
    else ctx.err('Traceback (most recent call last):\n  File "' + where + '", line ' + lineNo + (where === '<stdin>' ? ', in <module>\n' : ', in <module>\n') + err.kind + ': ' + err.msg + '\n');
    return 'error';
  }
  var PY_ONLY = '練習版的 Python 只會 print 和算式。\n';
  function* cmdPython(ctx) {
    var s = ctx.session, args = ctx.rawArgs.map(String);
    if (!termState.installed.python) { ctx.native(STORE_MSG + '\n'); s.lastExit = 9009; return 1; }
    var env = { vars: Object.create(null) };
    if (args[0] === '--version' || args[0] === '-V') { ctx.out('Python ' + PY_VER + '\n'); return 0; }
    if (args[0] === '-m') {
      if (args[1] === 'pip' && /^(--version|-V)$/.test(args[2] || '')) { ctx.out('pip 25.0.1 from C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\pip (python 3.12)\n'); return 0; }
      ctx.native('C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\python.exe: No module named ' + (args[1] || '') + '\n'); return 1;
    }
    function runLines(lines, where) {
      var outBuf = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (/^\s*(#.*)?$/.test(line)) continue;
        if (/^\s*(import|from|def|class|for|while|if|elif|else|try|with|return|lambda|global|del)\b/.test(line) || /^\s/.test(line)) { flush(); ctx.err(PY_ONLY); return 1; }
        try { var r = pyEvalLine(line, env, outBuf); flush(); if (where === '<stdin>' && !r.assigned && !r.empty && r.value !== undefined && r.value !== null) ctx.out(pyRepr(r.value) + '\n'); }
        catch (e) { flush(); var what = pyReport(ctx, e, where, line, i + 1); if (what === 'exit') return 'exit'; return 1; }
      }
      flush();
      return 0;
      function flush() { if (outBuf.length) { ctx.out(outBuf.join('')); outBuf.length = 0; } }
    }
    if (args[0] === '-c') { var rc = runLines(String(args[1] === undefined ? '' : args[1]).split(/;\s*|\n/), '<string>'); return rc === 'exit' ? 0 : rc; }
    if (args.length && args[0].charAt(0) !== '-') {
      var fr = resolvePath(s, args[0]), fst = fr.err ? null : s.vfs.stat(fr.abs);
      if (!fst || fst.type === 'dir') { ctx.native('C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\python.exe: can\'t open file \'' + (fr.disp || args[0]) + '\': [Errno 2] No such file or directory\n'); return 2; }
      var text = s.vfs.readFile(fst.path, { by: 'terminal' });
      var rcc = runLines(text.replace(/\r\n/g, '\n').split('\n'), fr.disp);
      return rcc === 'exit' ? 0 : rcc;
    }
    // the interactive REPL
    ctx.out('Python ' + PY_VER + ' (tags/v3.12.10:0cc8128, Apr  8 2025, 12:21:36) [MSC v.1943 64 bit (AMD64)] on win32\nType "help", "copyright", "credits" or "license" for more information.\n');
    for (;;) {
      var ans = yield { prompt: { text: '>>> ', kind: 'python' } };
      if (ans === undefined) return 0;
      var t = String(ans).trim();
      if (t === 'exit' || t === 'quit') { ctx.out('Use ' + t + '() or Ctrl-Z plus Return to exit\n'); continue; }
      if (t === '\u001a' || t === '^Z') return 0;
      var r2 = runLines([ans], '<stdin>');
      if (r2 === 'exit') return 0;
    }
  }

  /* ---- git: a repository kept in .git/ of the VFS (HEAD, config and refs are real small files; the history is one JSON file) */
  var GIT_VER = '2.51.0.windows.1';
  function gitRoot(S) {
    var p = S.cwd;
    for (;;) {
      if (S.vfs.isDir(S.vfs.join(p, '.git'))) return p;
      if (p === '/') return null;
      p = S.vfs.dirname(p);
    }
  }
  function gitLoad(S, root) {
    var f = S.vfs.join(root, '.git/lab-state.json');
    try { return JSON.parse(S.vfs.readFile(f, { by: 'system' })); } catch (e) { return { head: 'master', branches: { master: null }, commits: {}, index: {} }; }
  }
  function gitSave(S, root, st) {
    var vfs = S.vfs;
    vfs.writeFile(vfs.join(root, '.git/lab-state.json'), JSON.stringify(st), { by: 'system' });
    vfs.writeFile(vfs.join(root, '.git/HEAD'), 'ref: refs/heads/' + st.head + '\n', { by: 'system' });
    if (!vfs.exists(vfs.join(root, '.git/refs/heads'))) vfs.mkdir(vfs.join(root, '.git/refs/heads'), { by: 'system', parents: true });
    Object.keys(st.branches).forEach(function (b) { if (st.branches[b]) vfs.writeFile(vfs.join(root, '.git/refs/heads/' + b), st.branches[b] + '\n', { by: 'system' }); });
  }
  function gitWorking(S, root) {
    var out = {}, vfs = S.vfs;
    (function walk(dir, rel) {
      vfs.list(dir).forEach(function (k) {
        if (k.name === '.git' || isTrash(k)) return;
        var rp = rel ? rel + '/' + k.name : k.name;
        if (k.type === 'dir') walk(k.path, rp);
        else out[rp] = k.kind === 'binary' || k.kind === 'zip' || k.kind === 'app' ? { c: null, s: k.size } : { c: vfs.readFile(k.path, { by: 'system' }), s: k.size };
      });
    })(root, '');
    return out;
  }
  function sameFile(a, b) { return !!a && !!b && a.c === b.c && a.s === b.s; }
  function gitHeadTree(st) { var id = st.branches[st.head]; return id && st.commits[id] ? st.commits[id].tree : {}; }
  function fakeHash(text) { var h = 5381, out = ''; for (var k = 0; k < 5; k++) { for (var i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i) ^ k) >>> 0; out += ('00000000' + h.toString(16)).slice(-8); } return out; }
  function lineCount(c) { return c === null ? 0 : (c === '' ? 0 : c.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length); }
  function diffLines(a, b) {
    var x = a === null || a === '' ? [] : a.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'), y = b === null || b === '' ? [] : b.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
    var n = x.length, m = y.length, L = [], i, j;
    for (i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var ops = []; i = 0; j = 0;
    while (i < n && j < m) { if (x[i] === y[j]) { ops.push([' ', x[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { ops.push(['-', x[i]]); i++; } else { ops.push(['+', y[j]]); j++; } }
    while (i < n) ops.push(['-', x[i++]]); while (j < m) ops.push(['+', y[j++]]);
    return ops;
  }
  function gitStatusLists(st, work) {
    var head = gitHeadTree(st), idx = st.index, staged = [], unstaged = [], untracked = [];
    Object.keys(idx).forEach(function (p) { if (!head[p]) staged.push(['new file', p]); else if (!sameFile(idx[p], head[p])) staged.push(['modified', p]); });
    Object.keys(head).forEach(function (p) { if (!idx[p]) staged.push(['deleted', p]); });
    Object.keys(idx).forEach(function (p) { if (!work[p]) unstaged.push(['deleted', p]); else if (!sameFile(work[p], idx[p])) unstaged.push(['modified', p]); });
    Object.keys(work).forEach(function (p) { if (!idx[p]) untracked.push(p); });
    function srt(a) { return a.sort(function (x, y) { var a1 = typeof x === 'string' ? x : x[1], b1 = typeof y === 'string' ? y : y[1]; return a1 < b1 ? -1 : a1 > b1 ? 1 : 0; }); }
    return { staged: srt(staged), unstaged: srt(unstaged), untracked: srt(untracked) };
  }
  function collapseUntracked(list, tracked) {
    var out = [], seen = {};
    list.forEach(function (p) {
      var parts = p.split('/'), shown = p;
      for (var k = 1; k < parts.length; k++) { var dir = parts.slice(0, k).join('/') + '/'; if (!Object.keys(tracked).some(function (t) { return t.indexOf(dir) === 0; })) { shown = dir; break; } }
      if (!seen[shown]) { seen[shown] = 1; out.push(shown); }
    });
    return out;
  }
  function gitIdentity(ctx) { var c = termState.gitConfig; return c.name && c.email ? c : null; }
  function cmdGit(ctx) {
    var s = ctx.session, vfs = s.vfs, args = ctx.rawArgs.map(String), sub = args[0] || '';
    if (!sub || sub === '--help' || sub === 'help' || sub === '-h') {
      ctx.out('usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]\n           [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]\n           [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--no-lazy-fetch]\n           [--no-optional-locks] [--no-advice] [--bare] [--git-dir=<path>]\n           [--work-tree=<path>] [--namespace=<name>] [--config-env=<name>=<envvar>]\n           <command> [<args>]\n\nThese are common Git commands used in various situations:\n\nstart a working area (see also: git help tutorial)\n   clone     Clone a repository into a new directory\n   init      Create an empty Git repository or reinitialize an existing one\n\nwork on the current change (see also: git help everyday)\n   add       Add file contents to the index\n\nexamine the history and state (see also: git help revisions)\n   diff      Show changes between commits, commit and working tree, etc\n   log       Show commit logs\n   status    Show the working tree status\n\ngrow, mark and tweak your common history\n   branch    List, create, or delete branches\n   commit    Record changes to the repository\n   switch    Switch branches\n');
      return sub ? 0 : 1;
    }
    if (sub === '--version' || sub === 'version') { ctx.out('git version ' + GIT_VER + '\n'); return 0; }
    var rest = args.slice(1);
    if (sub === 'config') {
      var g = rest.filter(function (a) { return a !== '--global' && a !== '--local' && a !== '--system'; });
      if (g[0] === '--list' || g[0] === '-l') { var cf = termState.gitConfig; var lines = []; if (cf.name) lines.push('user.name=' + cf.name); if (cf.email) lines.push('user.email=' + cf.email); lines.push('core.autocrlf=true'); ctx.out(lines.join('\n') + '\n'); return 0; }
      if (g.length === 1) { var key = g[0].toLowerCase(), v = key === 'user.name' ? termState.gitConfig.name : (key === 'user.email' ? termState.gitConfig.email : null); if (v) { ctx.out(v + '\n'); return 0; } return 1; }
      if (g.length >= 2) { var k2 = g[0].toLowerCase(); if (k2 === 'user.name') termState.gitConfig.name = g[1]; else if (k2 === 'user.email') termState.gitConfig.email = g[1]; return 0; }
      return 1;
    }
    if (sub === 'init') {
      var tdir = s.cwd;
      if (rest[0] && rest[0].charAt(0) !== '-') { var rr = resolvePath(s, rest[0]); if (rr.err) { ctx.native('fatal: cannot mkdir ' + rest[0] + ': No such file or directory\n'); return 128; } tdir = rr.abs; if (!vfs.exists(tdir)) vfs.mkdir(tdir, { by: 'terminal', parents: true }); }
      var again = vfs.isDir(vfs.join(tdir, '.git'));
      if (!again) {
        vfs.mkdir(vfs.join(tdir, '.git'), { by: 'system' });
        vfs.writeFile(vfs.join(tdir, '.git/config'), '[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n\tlogallrefupdates = true\n\tignorecase = true\n', { by: 'system' });
        vfs.writeFile(vfs.join(tdir, '.git/description'), 'Unnamed repository; edit this file \'description\' to name the repository.\n', { by: 'system' });
        gitSave(s, tdir, { head: 'master', branches: { master: null }, commits: {}, index: {} });
        ctx.native("hint: Using 'master' as the name for the initial branch. This default branch name\nhint: is subject to change. To configure the initial branch name to use in all\nhint: of your new repositories, which will suppress this warning, call:\nhint:\nhint: \tgit config --global init.defaultBranch <name>\nhint:\nhint: Names commonly chosen instead of 'master' are 'main', 'trunk' and\nhint: 'development'. The just-created branch can be renamed via this command:\nhint:\nhint: \tgit branch -m <name>\n");
      }
      ctx.out((again ? 'Reinitialized existing' : 'Initialized empty') + ' Git repository in ' + winPath(vfs.join(tdir, '.git')).replace(/\\/g, '/') + '/\n');
      return 0;
    }
    if (sub === 'clone') { ctx.native("Cloning into '" + (rest[rest.length - 1] || 'repo').replace(/^.*[\/\\]/, '').replace(/\.git$/, '') + "'...\nfatal: unable to access '" + (rest[0] || '') + "': Could not resolve host: " + ((rest[0] || '').replace(/^https?:\/\//, '').split('/')[0]) + '\n'); return 128; }
    var root = gitRoot(s);
    if (!root) { ctx.native('fatal: not a git repository (or any of the parent directories): .git\n'); return 128; }
    var st = gitLoad(s, root), work = gitWorking(s, root);
    function save() { gitSave(s, root, st); }
    if (sub === 'status') {
      var short = rest.indexOf('-s') >= 0 || rest.indexOf('--short') >= 0, L = gitStatusLists(st, work), out = [];
      var untr = collapseUntracked(L.untracked, st.index);
      if (short) {
        var rows = {};
        L.staged.forEach(function (e) { rows[e[1]] = [e[0] === 'new file' ? 'A' : (e[0] === 'deleted' ? 'D' : 'M'), ' ']; });
        L.unstaged.forEach(function (e) { var r = rows[e[1]] || [' ', ' ']; r[1] = e[0] === 'deleted' ? 'D' : 'M'; rows[e[1]] = r; });
        Object.keys(rows).sort().forEach(function (p) { out.push(rows[p].join('') + ' ' + p); });
        untr.forEach(function (p) { out.push('?? ' + p); });
        if (out.length) ctx.out(out.join('\n') + '\n');
        return 0;
      }
      out.push('On branch ' + st.head);
      if (!st.branches[st.head]) out.push('', 'No commits yet');
      if (L.staged.length) { out.push('', 'Changes to be committed:', st.branches[st.head] ? '  (use "git restore --staged <file>..." to unstage)' : '  (use "git rm --cached <file>..." to unstage)'); L.staged.forEach(function (e) { out.push('\t' + padR(e[0] + ':', 12) + e[1]); }); }
      if (L.unstaged.length) { out.push('', 'Changes not staged for commit:', '  (use "git add <file>..." to update what will be committed)', '  (use "git restore <file>..." to discard changes in working directory)'); L.unstaged.forEach(function (e) { out.push('\t' + padR(e[0] + ':', 12) + e[1]); }); }
      if (untr.length) { out.push('', 'Untracked files:', '  (use "git add <file>..." to include in what will be committed)'); untr.forEach(function (p) { out.push('\t' + p); }); }
      out.push('');
      if (!L.staged.length && !L.unstaged.length) out.push(untr.length ? 'nothing added to commit but untracked files present (use "git add" to track)' : (st.branches[st.head] ? 'nothing to commit, working tree clean' : 'nothing to commit (create/copy files and use "git add" to track)'));
      else if (!L.staged.length) out.push('no changes added to commit (use "git add" and/or "git commit -a")');
      ctx.out(out.join('\n') + '\n');
      return 0;
    }
    if (sub === 'add') {
      var specs = rest.filter(function (a) { return a.charAt(0) !== '-'; }), all = rest.indexOf('-A') >= 0 || rest.indexOf('--all') >= 0;
      if (!specs.length && !all) { ctx.out('Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?\nhint: Disable this message with "git config set advice.addEmptyPathspec false"\n'); return 0; }
      var relCwd = s.cwd === root ? '' : s.cwd.slice(root.length + 1) + '/';
      var matched = 0;
      (all ? ['.'] : specs).forEach(function (sp) {
        var pre = sp === '.' ? relCwd : (relCwd + sp.replace(/\\/g, '/').replace(/^\.\//, '')).replace(/\/$/, '');
        var wild = hasWild(pre) ? wildRegex(pre) : null;
        Object.keys(work).forEach(function (p) { if (sp === '.' ? (relCwd === '' || p.indexOf(relCwd) === 0) : (wild ? wild.test(p) : (p === pre || p.indexOf(pre + '/') === 0))) { st.index[p] = work[p]; matched++; } });
        Object.keys(st.index).forEach(function (p) { if (!work[p] && (sp === '.' || p === pre || p.indexOf(pre + '/') === 0)) { delete st.index[p]; matched++; } });
        if (sp !== '.' && !matched) { ctx.native("fatal: pathspec '" + sp + "' did not match any files\n"); }
      });
      save();
      return matched || all || specs[0] === '.' ? 0 : 128;
    }
    if (sub === 'commit') {
      var mi = rest.indexOf('-m'), msg = null, auto = rest.indexOf('-a') >= 0 || rest.indexOf('-am') >= 0;
      rest.forEach(function (a, i) { if (a === '-m' || a === '-am') msg = rest[i + 1]; else if (/^-m./.test(a)) msg = a.slice(2); else if (/^--message=/.test(a)) msg = a.slice(10); });
      var id0 = gitIdentity(ctx);
      if (!id0) { ctx.native('Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account\'s default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address (got \'' + USER + '@' + HOST + '.(none)\')\n'); return 128; }
      if (msg === null || msg === undefined) { ctx.native('Aborting commit due to empty commit message.\n'); return 1; }
      if (auto) { Object.keys(st.index).forEach(function (p) { if (work[p]) st.index[p] = work[p]; else delete st.index[p]; }); }
      var head = gitHeadTree(st), changed = [], ins = 0, del = 0, created = [];
      Object.keys(st.index).forEach(function (p) { if (!head[p]) { changed.push(p); created.push(p); ins += lineCount(st.index[p].c); } else if (!sameFile(st.index[p], head[p])) { changed.push(p); diffLines(head[p].c, st.index[p].c).forEach(function (o) { if (o[0] === '+') ins++; else if (o[0] === '-') del++; }); } });
      Object.keys(head).forEach(function (p) { if (!st.index[p]) { changed.push(p); del += lineCount(head[p].c); } });
      if (!changed.length) {
        var L2 = gitStatusLists(st, work), u2 = collapseUntracked(L2.untracked, st.index), o2 = ['On branch ' + st.head];
        if (!st.branches[st.head]) o2.push('', 'Initial commit');
        if (L2.unstaged.length) { o2.push('', 'Changes not staged for commit:', '  (use "git add <file>..." to update what will be committed)', '  (use "git restore <file>..." to discard changes in working directory)'); L2.unstaged.forEach(function (e) { o2.push('\t' + padR(e[0] + ':', 12) + e[1]); }); }
        if (u2.length) { o2.push('', 'Untracked files:', '  (use "git add <file>..." to include in what will be committed)'); u2.forEach(function (p) { o2.push('\t' + p); }); }
        o2.push('', L2.unstaged.length ? 'no changes added to commit (use "git add" and/or "git commit -a")' : (u2.length ? 'nothing added to commit but untracked files present (use "git add" to track)' : (st.branches[st.head] ? 'nothing to commit, working tree clean' : 'nothing to commit (create/copy files and use "git add" to track)')));
        ctx.out(o2.join('\n') + '\n');
        return 1;
      }
      var tree = JSON.parse(JSON.stringify(st.index)), parent = st.branches[st.head] || null;
      var id = fakeHash(JSON.stringify(tree) + msg + (parent || '') + LAB.clock.ms());
      st.commits[id] = { id: id, parent: parent, msg: msg, name: id0.name, email: id0.email, ts: LAB.clock.ms(), tree: tree };
      st.branches[st.head] = id;
      save();
      ctx.out('[' + st.head + (parent ? '' : ' (root-commit)') + ' ' + id.slice(0, 7) + '] ' + msg + '\n ' + changed.length + ' file' + (changed.length === 1 ? '' : 's') + ' changed' + (ins ? ', ' + ins + ' insertion' + (ins === 1 ? '' : 's') + '(+)' : '') + (del ? ', ' + del + ' deletion' + (del === 1 ? '' : 's') + '(-)' : '') + '\n' +
        created.sort().map(function (p) { return ' create mode 100644 ' + p + '\n'; }).join(''));
      return 0;
    }
    if (sub === 'log') {
      var one = rest.indexOf('--oneline') >= 0, nlim = null;
      rest.forEach(function (a, i) { if (/^-\d+$/.test(a)) nlim = +a.slice(1); else if (a === '-n') nlim = +rest[i + 1]; });
      var cid = st.branches[st.head];
      if (!cid) { ctx.native("fatal: your current branch '" + st.head + "' does not have any commits yet\n"); return 128; }
      var logs = [], cnt = 0;
      while (cid && st.commits[cid] && (nlim === null || cnt < nlim)) {
        var cm = st.commits[cid], refs = [];
        if (cnt === 0) refs.push('HEAD -> ' + st.head);
        Object.keys(st.branches).forEach(function (b) { if (st.branches[b] === cid && !(cnt === 0 && b === st.head)) refs.push(b); });
        var rtxt = refs.length ? ' (' + refs.join(', ') + ')' : '';
        if (one) logs.push(cid.slice(0, 7) + rtxt + ' ' + cm.msg);
        else { var dd = new Date(cm.ts); logs.push('commit ' + cid + rtxt + '\nAuthor: ' + cm.name + ' <' + cm.email + '>\nDate:   ' + DAY_EN[dd.getDay()].slice(0, 3) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dd.getMonth()] + ' ' + dd.getDate() + ' ' + two(dd.getHours()) + ':' + two(dd.getMinutes()) + ':' + two(dd.getSeconds()) + ' ' + dd.getFullYear() + ' +0800\n\n    ' + cm.msg + '\n'); }
        cid = cm.parent; cnt++;
      }
      ctx.out(logs.join(one ? '\n' : '\n') + '\n');
      return 0;
    }
    if (sub === 'branch') {
      var names = rest.filter(function (a) { return a.charAt(0) !== '-'; });
      if (names.length && rest.indexOf('-d') < 0 && rest.indexOf('-D') < 0) {
        if (!st.branches[st.head]) { ctx.native('fatal: not a valid object name: \'' + st.head + '\'\n'); return 128; }
        if (hasOwn.call(st.branches, names[0])) { ctx.native("fatal: a branch named '" + names[0] + "' already exists\n"); return 128; }
        st.branches[names[0]] = st.branches[st.head]; save(); return 0;
      }
      if (names.length && (rest.indexOf('-d') >= 0 || rest.indexOf('-D') >= 0)) {
        if (!hasOwn.call(st.branches, names[0])) { ctx.native("error: branch '" + names[0] + "' not found.\n"); return 1; }
        if (names[0] === st.head) { ctx.native("error: cannot delete branch '" + names[0] + "' used by worktree at '" + winPath(root).replace(/\\/g, '/') + "'\n"); return 1; }
        var gone = st.branches[names[0]]; delete st.branches[names[0]]; save(); ctx.out("Deleted branch " + names[0] + ' (was ' + String(gone).slice(0, 7) + ').\n'); return 0;
      }
      var bl = Object.keys(st.branches).sort();
      if (!st.branches[st.head]) bl = [st.head];
      ctx.out(bl.map(function (b) { return (b === st.head ? '* ' : '  ') + b; }).join('\n') + '\n');
      return 0;
    }
    if (sub === 'switch' || sub === 'checkout') {
      var create = rest.indexOf('-c') >= 0 || rest.indexOf('-b') >= 0 || rest.indexOf('-C') >= 0;
      var target = rest.filter(function (a) { return a.charAt(0) !== '-'; })[0];
      if (!target) { ctx.native('fatal: missing branch or commit argument\n'); return 128; }
      if (create) {
        if (hasOwn.call(st.branches, target)) { ctx.native("fatal: a branch named '" + target + "' already exists\n"); return 128; }
        st.branches[target] = st.branches[st.head]; st.head = target; save(); ctx.native("Switched to a new branch '" + target + "'\n"); return 0;
      }
      if (!hasOwn.call(st.branches, target)) { ctx.native("fatal: invalid reference: " + target + '\n'); return 128; }
      if (target === st.head) { ctx.native("Already on '" + target + "'\n"); return 0; }
      var cur = gitHeadTree(st), L3 = gitStatusLists(st, work);
      if (L3.unstaged.length || L3.staged.length) { ctx.native('error: Your local changes to the following files would be overwritten by checkout:\n' + L3.unstaged.concat(L3.staged).map(function (e) { return '\t' + e[1]; }).join('\n') + '\nPlease commit your changes or stash them before you switch branches.\nAborting\n'); return 1; }
      st.head = target;
      var nt = gitHeadTree(st);
      Object.keys(cur).forEach(function (p) { if (!nt[p]) { try { vfs.remove(vfs.join(root, p), { by: 'system', force: true }); } catch (e) { /* ignore */ } } });
      Object.keys(nt).forEach(function (p) { if (nt[p].c !== null) { var full = vfs.join(root, p); vfs.mkdir(vfs.dirname(full), { by: 'system', parents: true }); vfs.writeFile(full, nt[p].c, { by: 'system' }); } });
      st.index = JSON.parse(JSON.stringify(nt));
      save();
      ctx.native("Switched to branch '" + target + "'\n");
      return 0;
    }
    if (sub === 'diff') {
      var stat = rest.indexOf('--stat') >= 0, staged = rest.indexOf('--staged') >= 0 || rest.indexOf('--cached') >= 0;
      var base = staged ? gitHeadTree(st) : st.index, cmpTo = staged ? st.index : work, paths = {};
      Object.keys(base).forEach(function (p) { paths[p] = 1; }); Object.keys(cmpTo).forEach(function (p) { if (staged || base[p]) paths[p] = 1; });
      var files = Object.keys(paths).sort().filter(function (p) { return !sameFile(base[p], cmpTo[p]); });
      if (!files.length) return 0;
      if (stat) {
        var wmax = Math.max.apply(null, files.map(function (p) { return displayWidth(p); })), tin = 0, tdel = 0, rowsS = [];
        files.forEach(function (p) { var a = 0, d = 0; diffLines(base[p] ? base[p].c : '', cmpTo[p] ? cmpTo[p].c : '').forEach(function (o) { if (o[0] === '+') a++; else if (o[0] === '-') d++; }); tin += a; tdel += d; rowsS.push([p, a, d]); });
        ctx.out(rowsS.map(function (r) { return ' ' + padR(r[0], wmax) + ' | ' + padL(String(r[1] + r[2]), String(Math.max.apply(null, rowsS.map(function (x) { return x[1] + x[2]; }))).length) + ' ' + new Array(r[1] + 1).join('+') + new Array(r[2] + 1).join('-'); }).join('\n') + '\n ' + files.length + ' file' + (files.length === 1 ? '' : 's') + ' changed' + (tin ? ', ' + tin + ' insertion' + (tin === 1 ? '' : 's') + '(+)' : '') + (tdel ? ', ' + tdel + ' deletion' + (tdel === 1 ? '' : 's') + '(-)' : '') + '\n');
        return 0;
      }
      var text = [];
      files.forEach(function (p) {
        var ops = diffLines(base[p] ? base[p].c : '', cmpTo[p] ? cmpTo[p].c : '');
        text.push('diff --git a/' + p + ' b/' + p);
        if (!base[p]) text.push('new file mode 100644'); else if (!cmpTo[p]) text.push('deleted file mode 100644');
        text.push('index ' + fakeHash(p + (base[p] ? base[p].c : '')).slice(0, 7) + '..' + fakeHash(p + (cmpTo[p] ? cmpTo[p].c : '')).slice(0, 7) + (base[p] && cmpTo[p] ? ' 100644' : ''), '--- ' + (base[p] ? 'a/' + p : '/dev/null'), '+++ ' + (cmpTo[p] ? 'b/' + p : '/dev/null'));
        var first = -1, last = -1;
        ops.forEach(function (o, i) { if (o[0] !== ' ') { if (first < 0) first = i; last = i; } });
        var from = Math.max(0, first - 3), to = Math.min(ops.length - 1, last + 3), oldN = 0, newN = 0, oldStart = 1, newStart = 1;
        for (var i = 0; i < from; i++) { oldStart++; newStart++; }
        var body = [];
        for (var k = from; k <= to; k++) { var o = ops[k]; body.push(o[0] + o[1]); if (o[0] !== '+') oldN++; if (o[0] !== '-') newN++; }
        text.push('@@ -' + oldStart + ',' + oldN + ' +' + newStart + ',' + newN + ' @@');
        body.forEach(function (b) { text.push(b); });
      });
      ctx.out(text.join('\n') + '\n');
      return 0;
    }
    if (sub === 'remote') { return 0; }
    if (sub === 'push' || sub === 'pull' || sub === 'fetch') { ctx.native(sub === 'push' ? 'fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>\n' : 'fatal: No remote repository specified.  Please, specify either a URL or a\nremote name from which new revisions should be fetched.\n'); return 1; }
    if (!/^(add|am|archive|bisect|blame|branch|bundle|checkout|cherry-pick|clean|clone|commit|config|describe|diff|fetch|format-patch|gc|grep|init|log|maintenance|merge|mv|notes|pull|push|rebase|reflog|remote|reset|restore|revert|rm|shortlog|show|sparse-checkout|stash|status|submodule|switch|tag|worktree|help|version)$/.test(sub)) {
      ctx.native("git: '" + sub + "' is not a git command. See 'git --help'.\n");
      return 1;
    }
    ctx.native('（練習版的 git 還沒有 ' + sub + ' 這個指令）\n');
    return 1;
  }
  function winPath(internal) { return LAB.win && LAB.win.toWin ? LAB.win.toWin(internal) : winOfSegs(splitSegs(internal)); }

  /* names that exist only after `winget install` (git) or always (python: the Store stub) */
  Object.assign(DYNAMIC, {
    git: { avail: function () { return !!termState.installed.git; }, def: { id: 'git', canon: 'git', native: true, name: 'git', run: cmdGit, nopaths: true } },
    'git.exe': { avail: function () { return !!termState.installed.git; }, def: { id: 'git', canon: 'git', native: true, name: 'git', run: cmdGit, nopaths: true } },
    python: { avail: function () { return true; }, def: { id: 'python', canon: 'python', native: true, name: 'python', run: cmdPython, nopaths: true } },
    'python.exe': { avail: function () { return true; }, def: { id: 'python', canon: 'python', native: true, name: 'python', run: cmdPython, nopaths: true } },
    python3: { avail: function () { return true; }, def: { id: 'python', canon: 'python', native: true, name: 'python3', run: cmdPython, nopaths: true } },
    'python3.exe': { avail: function () { return true; }, def: { id: 'python', canon: 'python', native: true, name: 'python3', run: cmdPython, nopaths: true } },
    pip: { avail: function () { return !!termState.installed.python; }, def: { id: 'pip', canon: 'python', native: true, name: 'pip', run: function (ctx) { ctx.out('pip 25.0.1 from C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\pip (python 3.12)\n'); return 0; }, nopaths: true } }
  });

  /* ---- Start-Process and the small Windows programs that open an app of the practice PC */
  function cmdCalc(ctx) { ctx.effect({ type: 'launch', appId: 'calculator' }); return 0; }
  function cmdTaskmgr(ctx) { ctx.effect({ type: 'launch', appId: 'taskmgr' }); return 0; }
  defCmd({ id: 'calc', canon: 'open', native: true, name: 'calc', run: cmdCalc, nopaths: true }, ['calc']);
  defCmd({ id: 'taskmgr', canon: 'open', native: true, name: 'taskmgr', run: cmdTaskmgr, nopaths: true }, ['taskmgr']);

  /* commands that exist in real Windows but are not simulated: say so instead of claiming they do not exist.
     (ping, ipconfig, tree, cmd /c, curl, winget ... are simulated since round 5; `ver`, `time` and the other cmd built-ins are not PowerShell commands at all) */
  var TIER2 = ['powershell', 'wt', 'more', 'ssh', 'scp', 'xcopy', 'robocopy', 'attrib', 'net', 'netstat', 'reg', 'regedit', 'shutdown', 'mspaint', 'sfc', 'chkdsk', 'msinfo32', 'cleanmgr', 'diskpart', 'format',
    'icacls', 'takeown', 'wmic', 'schtasks', 'sc.exe', 'bash', 'wsl', 'new-object', 'compare-object', 'diff', 'start-job', 'get-job', 'get-uptime', 'get-variable', 'set-variable', 'remove-variable', 'get-volume', 'get-disk',
    'get-psdrive', 'get-timezone', 'get-culture', 'get-netipaddress', 'get-netadapter', 'start-service', 'stop-service', 'restart-service', 'set-executionpolicy', 'get-executionpolicy', 'get-eventlog', 'get-wmiobject', 'get-ciminstance'];
  TIER2.forEach(function (n) { if (!hasOwn.call(CMDS, n)) CMDS[n] = { id: 'tier2', canon: 'unknown', tier2: true, name: n }; });

  rebuildCompleteNames();

  LAB.shell.library = true;
})(window.LAB);
