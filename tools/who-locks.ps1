# Find processes locking files via Restart Manager API (no admin needed)
param(
    [string[]]$Files = @(
        'F:\deepseek workplace\novel-studio\release\win-unpacked\resources\app.asar',
        'F:\deepseek workplace\novel-studio\release2\win-unpacked\resources\app.asar'
    )
)

$src = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class FileLockFinder {
    [StructLayout(LayoutKind.Sequential)]
    struct RM_UNIQUE_PROCESS { public int dwProcessId; public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime; }
    const int CCH_RM_MAX_APP_NAME = 255;
    const int CCH_RM_MAX_SVC_NAME = 63;
    enum RM_APP_TYPE { RmUnknownApp = 0, RmMainWindow = 1, RmOtherWindow = 2, RmService = 3, RmExplorer = 4, RmCritical = 1000 }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_APP_NAME + 1)] public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_SVC_NAME + 1)] public string strServiceShortName;
        public RM_APP_TYPE ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)] public bool bRestartable;
    }
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames, uint nApplications, [In] RM_UNIQUE_PROCESS[] rgApplications, uint nServices, string[] rgsServiceNames);
    [DllImport("rstrtmgr.dll")]
    static extern int RmGetList(uint dwSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo, [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);
    [DllImport("rstrtmgr.dll")]
    static extern int RmEndSession(uint pSessionHandle);

    public static List<int> FindLockers(string path) {
        uint handle;
        string key = Guid.NewGuid().ToString();
        var pids = new List<int>();
        int res = RmStartSession(out handle, 0, key);
        if (res != 0) throw new Exception("RmStartSession failed: " + res);
        try {
            uint needed = 0, count = 0, reasons = 0;
            res = RmRegisterResources(handle, 1, new string[] { path }, 0, null, 0, null);
            if (res != 0) throw new Exception("RmRegisterResources failed: " + res);
            res = RmGetList(handle, out needed, ref count, null, ref reasons);
            if (res == 234) {
                var info = new RM_PROCESS_INFO[needed];
                count = needed;
                res = RmGetList(handle, out needed, ref count, info, ref reasons);
                if (res == 0) for (int i = 0; i < count; i++) pids.Add(info[i].Process.dwProcessId);
            } else if (res != 0) {
                throw new Exception("RmGetList failed: " + res);
            }
        } finally { RmEndSession(handle); }
        return pids;
    }
}
'@

Add-Type -TypeDefinition $src -Language CSharp

foreach ($f in $Files) {
    Write-Output "FILE: $f"
    if (-not (Test-Path $f)) { Write-Output "  (file no longer exists)"; continue }
    try {
        $pids = [FileLockFinder]::FindLockers($f)
        if ($pids.Count -eq 0) { Write-Output "  No process currently holds this file" }
        foreach ($p in $pids) {
            $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
            $name = if ($proc) { $proc.Name } else { '<exited>' }
            $path = if ($proc) { $proc.Path } else { '?' }
            Write-Output ("  LOCKER PID={0}  NAME={1}  PATH={2}" -f $p, $name, $path)
        }
    } catch {
        Write-Output "  Query failed: $($_.Exception.Message)"
    }
    Write-Output ''
}
