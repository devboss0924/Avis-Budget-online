const puppeteer = require('puppeteer');
const csv = require('csv-parser');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const e = require("express");

let givenDate = process.argv[2];

let countNum = 0;

async function handleScraping() {
    for (let i = 0; i < 30; i++) {
        console.log(i);
        const newDate = new Date(givenDate + "-01");
        // console.log("newDate >>> ", newDate);
        newDate.setDate(newDate.getDate() + i);
        const startDate = newDate.toISOString().split('T')[0];
        const start_date = startDate.split("-")[1] + "/" + startDate.split("-")[2] + "/" + startDate.split("-")[0];
        newDate.setDate(newDate.getDate() + 330);
        const endDate = newDate.toISOString().split('T')[0];
        const end_date = endDate.split("-")[1] + "/" + endDate.split("-")[2] + "/" + endDate.split("-")[0];
        console.log("start date >>> ", start_date);
        console.log("end date >>> ", end_date);
        console.log("----------------------");
        // Create CSV Writer
        const csvWriter = createCsvWriter({
            path: 'Budget' + givenDate + '.csv',
            header: [
                {id: 'Code', title: 'Code'},
                {id: 'Name', title: 'Name'},
                {id: 'Type', title: 'Type'},
                {id: 'PayLater', title: 'PayLater'},
                {id: 'PayLaterTotal', title: 'PayLaterTotal'},
                {id: 'State', title: 'State'},
                {id: 'City', title: 'City'},
                {id: 'Full Location', title: 'Full Location'},
                {id: 'URL', title: 'URL'},
            ],
            append: false
        });


        async function readFileSequentially(filePath) {
            return new Promise((resolve, reject) => {
                let data = [];

                fs.createReadStream(filePath, {encoding: 'utf8'})
                    .pipe(csv({separator: ',', headers: false}))
                    .on('data', chunk => {
                        // console.log('data-->', chunk)
                        data.push(chunk);
                    })
                    .on('end', () => {
                        resolve(data);
                    })
                    .on('error', error => {
                        reject(error);
                    });
            });
        }

        async function processFilesSequentially(filePaths) {
            try {
                const data = await readFileSequentially(filePaths);
                for (const row of data) {
                    console.log("row >>> ", row);
                    // console.log(`Content of ${filePaths}:`, data);
                    const searchKey = row[3];
                    const state = row[0];
                    const city = row[1];
                    const fullLocation = row[4];
                    const link = row[2];
                    console.log("search key >>>>>> ", searchKey);

                    async function launchBrowser() {

                        let Digital_Token = null;
                        let RecaptchaResponse = null;
                        let Cookie = null;
                        let BasicPayload = null;
                        let carName = "";
                        let carDesc = "";
                        let payLaterAmount = "";
                        let payLaterTotalAmount = "";
                        let csvRow = [];
                        const writeData = [];

                        const browser = await puppeteer.launch({
                            headless: true, // Use the new Headless mode
                            // ... other options
                        });

                        // Rest of your code using the browser instance
                        const page = await browser.newPage();

                        // Enable request interception
                        await page.setRequestInterception(true);

                        // Listen for the request event
                        page.on('request', async (request) => {

                            if (!request.isNavigationRequest()) {
                                // It's an AJAX request
                                if (request.url().includes('https://www.budget.com/webapi/reservation/vehicles')) {
                                    // console.log("request >>> ", request.headers())

                                    BasicPayload = request.postData();
                                    // console.log("Payload >>> ", BasicPayload);

                                    if(BasicPayload) {
                                        Digital_Token = request.headers()['digital-token'];
                                        console.log("Digital Token >>> ", Digital_Token);
                                        Cookie = request.headers().cookie;
                                        // console.log("Cookie >>> ", Cookie);
                                        RecaptchaResponse = request.headers()['g-recaptcha-response'];
                                        // console.log("Recaptcha Response >>> ", RecaptchaResponse);
                                    }
                                }
                            }
                            request.continue();
                        });

                        // Navigate to a page that triggers AJAX requests
                        await page.goto('https://www.budget.com/en/home', {
                            timeout: 300000
                        });

                        // Delay function
                        function delay(ms) {
                            return new Promise((resolve) => setTimeout(resolve, ms));
                        }

                        // await delay(3000); // 10,000 milliseconds = 10 seconds
                        let modalXPath = '/html/body/div[4]/section/div[2]/div[1]/span';
                        try {
                            const [modalClose] = await page.$x(modalXPath);
                            await modalClose.click({timeout:300000});
                        } catch (error) {
                            console.log(error);
                        }

                        // await delay(3000); // 10,000 milliseconds = 10 seconds
                        let secModalXPath = '/html/body/div[4]/section/div[2]/div/div[1]/form/div[2]/div/div/div[2]/div/div/div/div/h4/span';
                        try {
                            const [secModalClose] = await page.$x(secModalXPath);
                            await secModalClose.click({timeout:300000});
                        } catch (error) {
                            console.log(error);
                        }

                        await page.waitForSelector('#PicLoc_value', {timeout: 300000});
                        await page.type('#PicLoc_value', 'shr');
                        await page.$eval('#from', (element) => {
                            element.value = "10/15/2023";
                        });

                        await delay(3000); // 10,000 milliseconds = 10 seconds
                        const endDateField = await page.waitForSelector('#to', {timeout: 300000});
                        await endDateField.click({timeout: 300000});

                        await delay(3000); // 10,000 milliseconds = 10 seconds
                        const endDateXPath = '//*[@id="ui-datepicker-div"]/div[3]/table/tbody/tr[1]/td[4]/a';
                        const [end_day] = await page.$x(endDateXPath);
                        await end_day.click({timeout: 300000});

                        await delay(3000); // 10,000 milliseconds = 10 seconds

                        const findButton = await page.waitForSelector('#res-home-select-car', {timeout: 300000});
                        await findButton.click({timeout: 300000});

                        await delay(3000); // 10,000 milliseconds = 10 seconds
                        
                        await fetch("https://www.budget.com/webapi/reservation/vehicles", {
                            "headers": {
                                "accept": "application/json, text/plain, */*",
                                "accept-language": "en-US,en;q=0.9",
                                "action": "RES_VEHICLESHOP",
                                "bookingtype": "car",
                                "channel": "Digital",
                                "content-type": "application/json",
                                "devicetype": "bigbrowser",
                                "digital-token": Digital_Token,
                                "domain": "us",
                                "g-recaptcha-response": RecaptchaResponse,
                                "initreservation": "true",
                                "locale": "en",
                                "password": "BUDCOM",
                                "sec-ch-ua": "\"Google Chrome\";v=\"117\", \"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"117\"",
                                "sec-ch-ua-mobile": "?0",
                                "sec-ch-ua-platform": "\"Windows\"",
                                "sec-fetch-dest": "empty",
                                "sec-fetch-mode": "cors",
                                "sec-fetch-site": "same-origin",
                                "username": "BUDCOM",
                                "cookie": Cookie,
                                "Referer": "https://www.budget.com/en/home",
                                "Referrer-Policy": "strict-origin-when-cross-origin"
                            },
                            "body": "{\"rqHeader\":{\"brand\":\"\",\"locale\":\"en_US\"},\"nonUSShop\":true,\"pickInfo\":\""+searchKey+"\",\"pickDate\":\""+start_date+"\",\"pickTime\":\"12:00 PM\",\"dropInfo\":\""+searchKey+"\",\"dropDate\":\""+end_date+"\",\"dropTime\":\"12:00 PM\",\"couponNumber\":\"\",\"couponInstances\":\"\",\"couponRateCode\":\"\",\"discountNumber\":\"\",\"rateType\":\"\",\"residency\":\"US\",\"age\":25,\"wizardNumber\":\"\",\"lastName\":\"\",\"userSelectedCurrency\":\"\",\"selDiscountNum\":\"\",\"promotionalCoupon\":\"\",\"preferredCarClass\":\"\",\"membershipId\":\"\",\"noMembershipAvailable\":false,\"corporateBookingType\":\"\",\"enableStrikethrough\":\"true\",\"amazonGCPayLaterPercentageVal\":\"\",\"amazonGCPayNowPercentageVal\":\"\",\"corporateEmailID\":\"\"}",
                            "method": "POST"
                        })
                            .then(response => {
                                if (response.ok) {
                                    return response.json(); // assuming the response is in JSON format
                                } else {
                                    throw new Error("Request failed with status " + response.status);
                                }
                            })
                            .then(data => {
                                // handle the response data here
                                console.log(data.vehicleSummaryList);
                                const infos = data.vehicleSummaryList;
                                for (let num = 0; num < infos.length; num++) {
                                    const info = infos[num];
                                    console.log("------------------------- info -------------------------");
                                    console.log(info);
                                    console.log("--------------------------------------------------------");
                                    if (info.payLaterRate) {
                                        // console.log("info>>> ", info);
                                        carName = info.make;
                                        console.log("Name >>> ", carName);
                                        carDesc = info.makeModel;
                                        // console.log("Type >>> ", carDesc);
                                        // const payLater = info.payLaterRate.amount;
                                        // console.log("payLater >>> ", payLater);
                                        payLaterAmount = info.payLaterRate.amount;
                                        // console.log("payLaterAmount >>> ", payLaterAmount);
                                        payLaterTotalAmount = info.payLaterRate.totalRateAmount;
                                        countNum = countNum + 1;
                                        csvRow[num] = {'Code': searchKey, 'Name': carName, 'Type': carDesc, 'PayLater': payLaterAmount, 'PayLaterTotal': payLaterTotalAmount, 'State': state, 'City': city, 'Full Location': fullLocation, 'URL': link}
                                        // console.log("csvRow[", num, "] = ", csvRow[num]);
                                        writeData.push(csvRow[num]);

                                        // Write data to CSV file
                                        csvWriter
                                            .writeRecords(writeData)
                                            .then(() => console.log('CSV file written successfully.'))
                                            .catch((err) => console.error('Error writing CSV file:', err));
                                    }
                                }
                            })
                            .catch(error => {
                                // handle any errors that occurred during the request
                                console.error(error);
                            });

                        await browser.close();
                    }

                    await launchBrowser()
                }

            } catch (error) {
                console.error(`Error reading file ${filePaths}:`, error);
            }
        }

        const files = 'budgetLocation.csv'; // Example file paths
        await processFilesSequentially(files);

    }

}

// date setting
handleScraping().then(res => {
    console.log('handle scraping have done!!')
})
