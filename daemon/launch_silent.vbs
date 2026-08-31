Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\Arka\kalpana-enterprises"
WshShell.Run "node.exe daemon\arka_print_daemon.js", 0, False
