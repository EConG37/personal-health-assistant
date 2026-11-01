using System;
using System.Runtime.InteropServices;
using System.Threading;

// Observe foreground ownership and outside mouse clicks while the panel is visible.
// No input hook, keystroke recording, network or health-data access.
static class PanelFocusObserver {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [StructLayout(LayoutKind.Sequential)] struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }

    static void Main(string[] args) {
        long handle;
        if (args.Length != 1 || !long.TryParse(args[0], out handle)) return;
        var panel = new IntPtr(handle);
        SetProcessDPIAware();
        bool wasActive = false, released = false;
        int outside = 0;
        while (IsWindow(panel) && IsWindowVisible(panel)) {
            var foreground = GetForegroundWindow();
            bool owned = foreground == panel || GetAncestor(foreground, 3) == panel;
            if (owned) wasActive = true;
            outside = wasActive && foreground != IntPtr.Zero && !owned ? outside + 1 : 0;
            bool mouseDown = (GetAsyncKeyState(1) & 0x8000) != 0 || (GetAsyncKeyState(2) & 0x8000) != 0;
            if (!mouseDown) released = true;
            Point point; Rect rect;
            bool outsideClick = released && mouseDown && GetCursorPos(out point) && GetWindowRect(panel, out rect) &&
                (point.X < rect.Left || point.X >= rect.Right || point.Y < rect.Top || point.Y >= rect.Bottom);
            // Owned modal dialogs retain the panel even if their pointer is outside it.
            bool ownedDialog = foreground != panel && GetAncestor(foreground, 3) == panel;
            if (outside >= 3 || (outsideClick && !ownedDialog)) {
                Console.WriteLine("outside");
                Console.Out.Flush();
                return;
            }
            Thread.Sleep(30);
        }
    }
}
