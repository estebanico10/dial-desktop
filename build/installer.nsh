!macro customInstall
  WriteRegStr HKCU "Software\Classes\*\shell\DIAL" "MUIVerb" "Analizar con DIAL"
  WriteRegStr HKCU "Software\Classes\*\shell\DIAL" "Icon" "$INSTDIR\DIAL.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\DIAL" "MultiSelectModel" "Player"
  WriteRegStr HKCU "Software\Classes\*\shell\DIAL\command" "" '"$INSTDIR\DIAL.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\Directory\shell\DIAL" "MUIVerb" "Analizar carpeta con DIAL"
  WriteRegStr HKCU "Software\Classes\Directory\shell\DIAL" "Icon" "$INSTDIR\DIAL.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\DIAL\command" "" '"$INSTDIR\DIAL.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DIAL" "MUIVerb" "Analizar esta carpeta con DIAL"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DIAL" "Icon" "$INSTDIR\DIAL.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DIAL\command" "" '"$INSTDIR\DIAL.exe" "%V"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\*\shell\DIAL"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\DIAL"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DIAL"
!macroend
