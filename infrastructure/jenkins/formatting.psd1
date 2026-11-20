@{
    IncludeRules = @(
        'PSUseConsistentIndentation',
        'PSUseConsistentWhitespace',
        'PSPlaceOpenBrace',
        'PSPlaceCloseBrace'
    )
    Rules = @{
        PSUseConsistentIndentation = @{ Enable = $true; Kind = 'space'; IndentationSize = 4 }
        PSUseConsistentWhitespace = @{ Enable = $true; CheckOperator = $true; CheckSeparator = $true; CheckOpenBrace = $true; CheckOpenParen = $true }
        PSPlaceOpenBrace = @{ Enable = $true; OnSameLine = $true; NewLineAfter = $true; IgnoreOneLineBlock = $false }
        PSPlaceCloseBrace = @{ Enable = $true; NewLineAfter = $true; IgnoreOneLineBlock = $false; NoEmptyLineBefore = $true }
    }
}
