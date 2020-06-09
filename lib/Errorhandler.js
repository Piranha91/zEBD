module.exports = function(logDir, fh)
    {
        let EH = {};

        const errorLogPath = generateErrorLogPath(logDir);

        EH.alertError = function (errorToDisplay)
        {
            alert(errorToDisplay + "\nPlease check Logs\\zEBDerrors.txt for details.");
        };

        EH.logError = function (errorOccurredDuring, errorToLog)
        {
            let toWrite = "";
            const fs = require('fs')
            try
            {
                if (fs.existsSync(errorLogPath))
                {
                    toWrite = fh.loadTextFile(errorLogPath);
                }
            } catch (e)
            {
                alert("Error: could not read error log file at " + errorLogPath);
            }

            if (errorToLog != "")
            {
                toWrite += "An error occured during " + errorOccurredDuring + "\n";
                toWrite += "Details: \n" + errorToLog + "\n";
                try
                {
                    fh.saveTextFile(errorLogPath, toWrite);
                } catch (e)
                {
                    alert("Error: could not write error log file at " + errorLogPath);
                }
            }
        };

        return EH;
    }

function generateErrorLogPath (logDir)
{
    let currentDate = new Date(); // initialized with current timestamp
    let dateString = currentDate.toUTCString();
    dateString = dateString.replace(new RegExp(':', 'g'), '-');
    return logDir + "\\zEBDerrors_" + dateString + ".txt";
}