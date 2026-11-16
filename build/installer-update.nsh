!macro customInstall
  FileOpen $0 "$INSTDIR\novel-studio-nsis.install" w
  FileWrite $0 "novel-studio"
  FileClose $0
!macroend

!macro customUnInstall
  Delete "$INSTDIR\novel-studio-nsis.install"
!macroend
