---
layout: post
title: "Tự động gỡ phần mềm ngoài Software Catalog: từ SentinelOne, Power BI, Power Automate đến Intune và AppLocker"
seo_title: "Tự động gỡ app ngoài Software Catalog bằng Intune"
description: "Quy trình tự động phát hiện app không được phép từ SentinelOne, so sánh với Software Catalog, gửi mail user, gỡ bằng Intune và chặn cài lại bằng AppLocker."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 12
topic: security
thumb_label: "APP GOVERNANCE"
image: /images/photo/9.jpg
tags:
  - Intune
  - Power Automate
  - Power BI
  - AppLocker
  - SentinelOne
card_tags:
  - Intune
  - AppLocker
summary: "Quy trình end-to-end: quét app bằng SentinelOne, so với Software Catalog, báo user, gỡ qua Intune và chặn cài lại bằng AppLocker."
redirect_from:
  - /posts/tu-dong-go-app-ngoai-software-catalog.html
---

Mỗi tháng, License Team gửi cho mình một file Excel vài nghìn dòng: app nào, trên máy nào, ai đang dùng, và "cái này có trong Catalog không?". Với khoảng **2.000 máy Windows**, việc VLOOKUP tay, hỏi từng user rồi gỡ từng máy là không thể theo kịp. Chưa kể gỡ xong tuần sau user lại cài lại. Bài này chia sẻ cách mình biến toàn bộ quy trình đó thành một chuỗi tự động: **phát hiện → so sánh → thông báo → gỡ → chặn cài lại**.

> **Tóm tắt nhanh:** SentinelOne quét app trên mọi máy, Power BI hiển thị, Power Automate lấy dữ liệu và so với Software Catalog của License Team. App ngoài Catalog được đưa vào một script uninstall dùng chung, đóng gói `.intunewin` và deploy qua Intune, kèm email báo trước cho user. Cuối cùng, app đó được thêm vào AppLocker để user không cài lại được.

## Bối cảnh: vì sao cần tự động hóa

Quy trình làm tay trước đây có ba vấn đề:

- **Chậm** — so sánh inventory với Catalog mất nhiều giờ, mỗi lần lại phải sửa cột mapping tên app.
- **Không đo được** — gỡ 100 app trên 50 máy, nhưng không biết bao nhiêu lần gỡ thành công.
- **Không bền** — gỡ xong mà không chặn thì user cài lại ngay.

Mục tiêu là một quy trình mà IT chỉ cần **duyệt**, còn lại để hệ thống chạy.

## Kiến trúc tổng thể

| Bước | Thành phần | Việc làm | Đầu ra |
|---|---|---|---|
| 1 | **SentinelOne** | Quét app đã cài trên toàn bộ endpoint | Application inventory |
| 2 | **Power BI** | Hiển thị inventory, làm nguồn dữ liệu chung | Dataset `All Apps` |
| 3 | **Power Automate** | Lấy `App Name`, `App Brand`, `Device Name`, `User Name` | Mảng dữ liệu thô + file backup |
| 4 | **Software Catalog** | File Excel Online do License Team quản lý | Danh sách app được phép |
| 5 | **Power Automate** | So sánh theo cặp `App Name` + `App Brand` | Danh sách app ngoài Catalog |
| 6 | **License Team** | Duyệt: gỡ, hay thêm vào Catalog / ngoại lệ | Danh sách đã duyệt |
| 7 | **Outlook** | Gửi mail báo user trước khi gỡ | Email theo từng user |
| 8 | **Script + IntuneWinAppUtil** | Đưa tên app vào script uninstall, đóng gói | File `.intunewin` |
| 9 | **Intune** | Upload Win32 app, assign cho nhóm máy cần gỡ | Kết quả gỡ theo từng máy |
| 10 | **AppLocker** | Thêm Deny rule cho app vừa gỡ | User không cài lại được |
| 11 | **Power BI** | Theo dõi tỷ lệ gỡ thành công | Dashboard |

*Hình 1: luồng end-to-end từ SentinelOne đến AppLocker.*

## Bước 1-3: Lấy dữ liệu app từ SentinelOne qua Power BI

SentinelOne đã có sẵn inventory app trên mọi máy, nên mình không cần agent quét riêng. Dữ liệu được đưa vào Power BI, và Power Automate đọc lại từ dataset bằng action **Run a query against a dataset**.

### DAX query lấy 4 trường cần thiết

```dax
EVALUATE
SELECTCOLUMNS (
    'S1_Applications',
    "App Name",    'S1_Applications'[Name],
    "App Brand",   'S1_Applications'[Publisher],
    "Device Name", 'S1_Applications'[Endpoint Name],
    "User Name",   'S1_Applications'[Last Logged In User]
)
```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Action <code>Run a query against a dataset</code> có giới hạn số dòng trả về cho mỗi lần query. Với inventory lớn, hãy lọc bớt ngay trong DAX (ví dụ bỏ app của Microsoft, driver hệ thống) hoặc chia query theo nhóm máy, và tách flow lớn thành nhiều flow con.</div>
</div>

Mình cũng lưu một bản **full backup** của dữ liệu thô ra SharePoint mỗi lần chạy, để khi có tranh luận "máy em đâu có app đó" thì vẫn có bằng chứng.

## Bước 4-5: So sánh với Software Catalog

Software Catalog là file Excel Online do License Team quản lý, tối thiểu có hai cột `App Name` và `App Brand`. Power Automate đọc bằng action **List rows present in a table**.

### Không dùng Apply to each để so sánh

Lặp từng dòng inventory rồi lại lặp từng dòng Catalog sẽ chạy hàng giờ. Cách nhanh hơn là tạo **khóa so sánh** rồi dùng **Filter array**:

1. **Select** trên Catalog để tạo mảng khóa:

```text
toLower(trim(concat(item()?['App Name'], '|', item()?['App Brand'])))
```

2. **Filter array** trên inventory, giữ lại dòng **không** nằm trong mảng khóa:

```text
@not(contains(body('Select_Catalog_Keys'), toLower(trim(concat(item()?['[App Name]'], '|', item()?['[App Brand]'])))))
```

Lưu ý: dữ liệu trả về từ Power BI có tên cột dạng `[App Name]`, có dấu ngoặc vuông.

3. Xuất kết quả ra file **Compared file** (CSV/Excel) cho License Team duyệt.

### Bài toán tên app không khớp

Đây là phần mất thời gian nhất. Cùng một phần mềm nhưng tên trong SentinelOne khác tên trong Catalog, ví dụ `.NET SDK x64` và `.NET Core`, hay `Zoom Workplace` và `Zoom`. Mình xử lý bằng một **bảng mapping** đặt cạnh Catalog, quy tên trong inventory về tên chuẩn trước khi so sánh. Bảng này nhỏ dần theo thời gian vì License Team bổ sung tên chuẩn vào Catalog.

### Script / flow của mình


```text
# Power Automate - Compare Inventory vs Software Catalog
{
  "properties": {
    "connectionReferences": {
      "shared_excelonlinebusiness": {
        "runtimeSource": "embedded",
        "connection": {
          "connectionReferenceLogicalName": "<PREFIX>_sharedexcelonlinebusiness_<ID>"
        },
        "api": {
          "name": "shared_excelonlinebusiness"
        }
      },
      "shared_sharepointonline": {
        "runtimeSource": "embedded",
        "connection": {
          "connectionReferenceLogicalName": "<PREFIX>_sharedsharepointonline_<ID>"
        },
        "api": {
          "name": "shared_sharepointonline"
        }
      },
      "shared_powerbi": {
        "runtimeSource": "embedded",
        "connection": {
          "connectionReferenceLogicalName": "<PREFIX>_sharedpowerbi_<ID>"
        },
        "api": {
          "name": "shared_powerbi"
        }
      }
    },
    "definition": {
      "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      "contentVersion": "undefined",
      "parameters": {
        "$connections": {
          "defaultValue": {},
          "type": "Object"
        },
        "$authentication": {
          "defaultValue": {},
          "type": "SecureObject"
        }
      },
      "triggers": {
        "Recurrence": {
          "recurrence": {
            "frequency": "Month",
            "interval": 1,
            "timeZone": "SE Asia Standard Time",
            "startTime": "2026-05-23T11:00:00Z"
          },
          "evaluatedRecurrence": {
            "frequency": "Month",
            "interval": 1,
            "timeZone": "SE Asia Standard Time",
            "startTime": "2026-05-23T11:00:00Z"
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000001"
          },
          "type": "Recurrence"
        }
      },
      "actions": {
        "Apply_to_each": {
          "foreach": "@outputs('Compose_Half1')",
          "actions": {
            "Condition": {
              "actions": {
                "Add_a_row_into_a_table_1": {
                  "runAfter": {},
                  "metadata": {
                    "operationMetadataId": "00000000-0000-0000-0000-000000000002"
                  },
                  "type": "OpenApiConnection",
                  "inputs": {
                    "parameters": {
                      "source": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
                      "drive": "<DRIVE_ID>",
                      "file": "/Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Apps_Exclude_Software_Catalog.xlsx",
                      "table": "{<TABLE_ID_APPS_EXCLUDE>}",
                      "item/App_Name": "@items('Apply_to_each')?['[App_Name]']",
                      "item/Publisher": "@items('Apply_to_each')?['[Publisher]']",
                      "item/Computer_Name": "@items('Apply_to_each')?['[Computer_Name]']",
                      "item/User_Name": "@items('Apply_to_each')?['[User_Name]']",
                      "item/OS_Name": "@items('Apply_to_each')?['[OS_Name]']",
                      "item/Last_Active": "@items('Apply_to_each')?['[Last_Active]']",
                      "item/Last_Reboot": "@items('Apply_to_each')?['[Last_Reboot]']",
                      "item/Date_Time": "@formatDateTime(utcNow(),'yyyy-MM-dd HH:mm:ss.fff')"
                    },
                    "host": {
                      "connectionName": "shared_excelonlinebusiness",
                      "operationId": "AddRowV2",
                      "apiId": "/providers/Microsoft.PowerApps/apis/shared_excelonlinebusiness"
                    },
                    "authentication": "@parameters('$authentication')"
                  },
                  "description": "Add app not in Software Catalog to Excel file"
                }
              },
              "runAfter": {
                "Filter_array": [
                  "Succeeded"
                ]
              },
              "expression": {
                "and": [
                  {
                    "equals": [
                      "@equals(length(body('Filter_array')), 0)",
                      "@true"
                    ]
                  }
                ]
              },
              "metadata": {
                "operationMetadataId": "00000000-0000-0000-0000-000000000003"
              },
              "type": "If",
              "description": "If the AppName into S1 All App have in Software Catalog -> True"
            },
            "Filter_array": {
              "runAfter": {},
              "metadata": {
                "operationMetadataId": "00000000-0000-0000-0000-000000000004"
              },
              "type": "Query",
              "inputs": {
                "from": "@variables('varSoftwareMapping')",
                "where": "@and(\r\n contains(\r\n toLower(trim(string(coalesce(item()?['Software_Mapping'], '')))), \r\n toLower(trim(string(coalesce(items('Apply_to_each')?['[App_Name]'], ''))))\r\n ),\r\n contains(\r\n toLower(trim(string(coalesce(item()?['Brand_Mapping'], '')))),\r\n toLower(trim(string(coalesce(items('Apply_to_each')?['[Publisher]'], ''))))\r\n )\r\n)"
              },
              "description": "Check AppName into S1 All Apps have or contain name with Software Catalog"
            }
          },
          "runAfter": {
            "Initialize_variable": [
              "Succeeded"
            ],
            "Compose_Half2": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000005"
          },
          "type": "Foreach",
          "description": "For each 1/2 app into S1 All Apps"
        },
        "Select_1": {
          "runAfter": {
            "List_rows_present_in_a_table_3_1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000006"
          },
          "type": "Select",
          "inputs": {
            "from": "@outputs('List_rows_present_in_a_table_3_1')?['body/value']",
            "select": {
              "Software_Mapping": "@item()?['Software Product Mapping']",
              "Brand_Mapping": "@item()?['Brand Mapping']"
            }
          },
          "description": "Select data need to use Software_Product"
        },
        "Initialize_variable": {
          "runAfter": {
            "Select_1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000007"
          },
          "type": "InitializeVariable",
          "inputs": {
            "variables": [
              {
                "name": "varSoftwareMapping",
                "type": "array",
                "value": "@body('Select_1')"
              }
            ]
          },
          "description": "Create array"
        },
        "Filter_array_2": {
          "runAfter": {
            "Get_files_(properties_only)": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000008"
          },
          "type": "Query",
          "inputs": {
            "from": "@outputs('Get_files_(properties_only)')?['body/value']",
            "where": "@contains(item()?['{Name}'],'Apps_Exclude_Software_Catalog')"
          }
        },
        "Compose": {
          "runAfter": {
            "Filter_array_2": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000009"
          },
          "type": "Compose",
          "inputs": "@reverse(sort(body('Filter_array_2'), 'Modified'))"
        },
        "Compose_1": {
          "runAfter": {
            "Compose": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000010"
          },
          "type": "Compose",
          "inputs": "@first(outputs('Compose'))"
        },
        "Apply_to_each_2": {
          "foreach": "@outputs('List_rows_present_in_a_table_3_2')?['body/value']",
          "actions": {
            "Filter_array_3": {
              "runAfter": {},
              "metadata": {
                "operationMetadataId": "00000000-0000-0000-0000-000000000011"
              },
              "type": "Query",
              "inputs": {
                "from": "@outputs('List_rows_present_in_a_table_3_2_1')?['body/value']",
                "where": "@and(\r\n equals(item()?['App_Name'], items('Apply_to_each_2')?['App_Name']),\r\n equals(item()?['Computer_Name'], items('Apply_to_each_2')?['Computer_Name'])\r\n)\r\n"
              },
              "description": "Filter array The Old/Backup Apps_Exclude_Catalog file"
            },
            "Condition_1": {
              "actions": {
                "Update_a_row_2": {
                  "runAfter": {},
                  "metadata": {
                    "<DRIVE_ITEM_ID>": "/<FOLDER_PATH>/Apps_Exclude_Catalog_Test.xlsx",
                    "tableId": "{<TABLE_ID_APPS_EXCLUDE>}",
                    "operationMetadataId": "00000000-0000-0000-0000-000000000012"
                  },
                  "type": "OpenApiConnection",
                  "inputs": {
                    "parameters": {
                      "source": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
                      "drive": "<DRIVE_ID>",
                      "file": "/Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Apps_Exclude_Software_Catalog.xlsx",
                      "table": "{<TABLE_ID_APPS_EXCLUDE>}",
                      "idColumn": "Date_Time",
                      "id": "@items('Apply_to_each_2')?['Date_Time']",
                      "item/Repeat_Last_Time": "Yes"
                    },
                    "host": {
                      "connectionName": "shared_excelonlinebusiness",
                      "operationId": "PatchItem",
                      "apiId": "/providers/Microsoft.PowerApps/apis/shared_excelonlinebusiness"
                    },
                    "authentication": "@parameters('$authentication')"
                  },
                  "description": "Update to column Repeat the apps"
                }
              },
              "runAfter": {
                "Filter_array_3": [
                  "Succeeded"
                ]
              },
              "else": {
                "actions": {
                  "Update_a_row_2_1": {
                    "runAfter": {},
                    "metadata": {
                      "<DRIVE_ITEM_ID>": "/<FOLDER_PATH>/Apps_Exclude_Catalog_Test.xlsx",
                      "tableId": "{<TABLE_ID_APPS_EXCLUDE>}",
                      "operationMetadataId": "00000000-0000-0000-0000-000000000013"
                    },
                    "type": "OpenApiConnection",
                    "inputs": {
                      "parameters": {
                        "source": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
                        "drive": "<DRIVE_ID>",
                        "file": "/Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Apps_Exclude_Software_Catalog.xlsx",
                        "table": "{<TABLE_ID_APPS_EXCLUDE>}",
                        "idColumn": "Date_Time",
                        "id": "@items('Apply_to_each_2')?['Date_Time']",
                        "item/Repeat_Last_Time": "No"
                      },
                      "host": {
                        "connectionName": "shared_excelonlinebusiness",
                        "operationId": "PatchItem",
                        "apiId": "/providers/Microsoft.PowerApps/apis/shared_excelonlinebusiness"
                      },
                      "authentication": "@parameters('$authentication')"
                    },
                    "description": "Update to column Repeat the apps"
                  }
                }
              },
              "expression": {
                "and": [
                  {
                    "greater": [
                      "@length(body('Filter_array_3'))",
                      0
                    ]
                  }
                ]
              },
              "metadata": {
                "operationMetadataId": "00000000-0000-0000-0000-000000000014"
              },
              "type": "If"
            }
          },
          "runAfter": {
            "List_rows_present_in_a_table_3_2": [
              "Succeeded"
            ],
            "List_rows_present_in_a_table_3_2_1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000015"
          },
          "type": "Foreach",
          "description": "Apply to each The new Apps_Exclude_Catalog file"
        },
        "Move_file": {
          "runAfter": {},
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000016"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "dataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "parameters/sourceFileId": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Remove_App.ps1",
              "parameters/destinationDataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "parameters/destinationFolderPath": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Backup",
              "parameters/nameConflictBehavior": 2
            },
            "host": {
              "connectionName": "shared_sharepointonline",
              "operationId": "MoveFileAsync",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Backup old Windows Uninstall Script - Move"
        },
        "Move_file_1": {
          "runAfter": {
            "Move_file": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000017"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "dataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "parameters/sourceFileId": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Remove_App_MacOS.sh",
              "parameters/destinationDataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "parameters/destinationFolderPath": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Backup",
              "parameters/nameConflictBehavior": 2
            },
            "host": {
              "connectionName": "shared_sharepointonline",
              "operationId": "MoveFileAsync",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Backup old Uninstall MacOS Script - Move"
        },
        "Move_file_1_1": {
          "runAfter": {
            "Move_file_1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000018"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "dataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "parameters/sourceFileId": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>/S1_All_Apps.csv",
              "parameters/destinationDataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "parameters/destinationFolderPath": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Backup",
              "parameters/nameConflictBehavior": 2
            },
            "host": {
              "connectionName": "shared_sharepointonline",
              "operationId": "MoveFileAsync",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Backup old S1 all apps - Move"
        },
        "Copy_file": {
          "runAfter": {
            "Move_file_1_1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000019"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "dataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "parameters/sourceFileId": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Apps_Exclude_Software_Catalog.xlsx",
              "parameters/destinationDataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "parameters/destinationFolderPath": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Backup",
              "parameters/nameConflictBehavior": 2
            },
            "host": {
              "connectionName": "shared_sharepointonline",
              "operationId": "CopyFileAsync",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Backup old apps need to uninstall - Copy. \nBecause need keep old file to add new rows"
        },
        "List_rows_present_in_a_table_3_1": {
          "runAfter": {
            "Run_script": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000020"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "source": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "drive": "<DRIVE_ID>",
              "file": "/Documents/<ROOT_FOLDER>/<CATALOG_FOLDER>/Software_Catalog.xlsx",
              "table": "{<TABLE_ID_SOFTWARE_CATALOG>}"
            },
            "host": {
              "connectionName": "shared_excelonlinebusiness",
              "operationId": "GetItems",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_excelonlinebusiness"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Get Software Catalog app",
          "runtimeConfiguration": {
            "paginationPolicy": {
              "minimumItemCount": 1500
            }
          }
        },
        "List_rows_present_in_a_table_3_2": {
          "runAfter": {
            "Get_files_(properties_only)": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000021"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "source": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "drive": "<DRIVE_ID>",
              "file": "/Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Apps_Exclude_Software_Catalog.xlsx",
              "table": "{<TABLE_ID_APPS_EXCLUDE>}"
            },
            "host": {
              "connectionName": "shared_excelonlinebusiness",
              "operationId": "GetItems",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_excelonlinebusiness"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "List rows from The new Apps_Exclude_Catalog file",
          "runtimeConfiguration": {
            "paginationPolicy": {
              "minimumItemCount": 3000
            }
          }
        },
        "List_rows_present_in_a_table_3_2_1": {
          "runAfter": {
            "Compose_1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000022"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "source": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "drive": "<DRIVE_ID>",
              "file": "/Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Backup/@{outputs('Compose_1')?['{FilenameWithExtension}']}",
              "table": "Apps_Exclude_Catalog"
            },
            "host": {
              "connectionName": "shared_excelonlinebusiness",
              "operationId": "GetItems",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_excelonlinebusiness"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "List rows from The Old/Backup Apps_Exclude_Catalog file",
          "runtimeConfiguration": {
            "paginationPolicy": {
              "minimumItemCount": 3000
            }
          }
        },
        "Get_files_(properties_only)": {
          "runAfter": {
            "Apply_to_each_1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000023"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "dataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "table": "<DOCUMENT_LIBRARY_ID>",
              "folderPath": "/<ROOT_FOLDER>/<DATA_FOLDER>/Backup"
            },
            "host": {
              "connectionName": "shared_sharepointonline",
              "operationId": "GetFileItems",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
            },
            "authentication": "@parameters('$authentication')"
          },
          "runtimeConfiguration": {
            "paginationPolicy": {
              "minimumItemCount": 5000
            }
          }
        },
        "Run_script": {
          "runAfter": {
            "Copy_file": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000024"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "source": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "drive": "<DRIVE_ID>",
              "file": "/Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Apps_Exclude_Software_Catalog.xlsx",
              "scriptId": "ms-officescript%3A%2F%2Fonedrive_business_itemlink%2F<OFFICE_SCRIPT_ITEM_ID>"
            },
            "host": {
              "connectionName": "shared_excelonlinebusiness",
              "operationId": "RunScriptProd",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_excelonlinebusiness"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Delete all old rows"
        },
        "Run_a_query_against_a_dataset_-_A_to_H": {
          "runAfter": {
            "Run_script": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000025"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "groupid": "<POWERBI_WORKSPACE_ID>",
              "datasetid": "<POWERBI_DATASET_ID>",
              "specification/query": "DEFINE\nVAR __DS0Core =\n SELECTCOLUMNS (\n KEEPFILTERS (\n FILTER (\n KEEPFILTERS (\n SUMMARIZECOLUMNS (\n 'Applications'[app.name],\n 'Applications'[app.vendorName],\n 'Intune_Device'[deviceName],\n 'Agents'[agent.lastLoggedInUser],\n 'Agents'[resourceType],\n 'Agents'[serialNumber],\n 'Agents'[lastActiveDt],\n 'Agents'[lastRebootDt],\n\n /* Site Filter */\n KEEPFILTERS (\n FILTER (\n ALL ( 'Agents'[s1SiteName] ),\n TRIM ( 'Agents'[s1SiteName] ) = \"<S1_SITE_NAME>\"\n )\n ),\n\n /* OS Filter */\n KEEPFILTERS (\n FILTER (\n ALL ( 'Agents'[resourceType] ),\n TRIM ( 'Agents'[resourceType] ) = \"Windows laptop\"\n )\n ),\n\n /* Device Name Filter: XX-A to XX-H, XX-0 to XX-9 */\n\t\t\t\t\t\tKEEPFILTERS (\n\t\t\t\t\t\t\tFILTER (\n\t\t\t\t\t\t\t\tALL ( 'Intune_Device'[deviceName] ),\n\t\t\t\t\t\t\t\tVAR PrefixChar =\n\t\t\t\t\t\t\t\t\tMID (\n\t\t\t\t\t\t\t\t\t\tUPPER ( TRIM ( 'Intune_Device'[deviceName] ) ),\n\t\t\t\t\t\t\t\t\t\t4,\n\t\t\t\t\t\t\t\t\t\t1\n\t\t\t\t\t\t\t\t\t)\n\t\t\t\t\t\t\t\tRETURN\n\t\t\t\t\t\t\t\t\t(\n\t\t\t\t\t\t\t\t\t\tPrefixChar >= \"A\"\n\t\t\t\t\t\t\t\t\t\t\t&& PrefixChar <= \"H\"\n\t\t\t\t\t\t\t\t\t)\n\t\t\t\t\t\t\t\t\t||\n\t\t\t\t\t\t\t\t\t(\n\t\t\t\t\t\t\t\t\t\tPrefixChar >= \"0\"\n\t\t\t\t\t\t\t\t\t\t\t&& PrefixChar <= \"9\"\n\t\t\t\t\t\t\t\t\t)\n\t\t\t\t\t\t\t)\n\t\t\t\t\t\t),\n \"CountRowsApplications\", COUNTROWS ( 'Applications' ),\n \"CountRowsAgents\", COUNTROWS ( 'Agents' )\n )\n ),\n OR (\n NOT ( ISBLANK ( 'Applications'[app.name] ) ),\n NOT ( ISBLANK ( 'Intune_Device'[deviceName] ) )\n )\n )\n ),\n\n /* Output Columns */\n \"App_Name\", 'Applications'[app.name],\n \"Publisher\", 'Applications'[app.vendorName],\n \"Computer_Name\", 'Intune_Device'[deviceName],\n \"User_Name\", 'Agents'[agent.lastLoggedInUser],\n \"OS_Name\", 'Agents'[resourceType],\n \"Serial_Number\", 'Agents'[serialNumber],\n \"Last_Active\", 'Agents'[lastActiveDt],\n \"Last_Reboot\", 'Agents'[lastRebootDt]\n )\n\nEVALUATE\n __DS0Core\n\nORDER BY\n [Computer_Name],\n [Publisher],\n [OS_Name],\n [App_Name],\n [User_Name],\n [Serial_Number],\n [Last_Active],\n [Last_Reboot]",
              "specification/serializerSettings/includeNulls": false
            },
            "host": {
              "connectionName": "shared_powerbi",
              "operationId": "ExecuteDatasetQuery",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_powerbi"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Get data from Power BI dashboard S1 -> All Apps"
        },
        "Create_CSV_table_-_A_to_H": {
          "runAfter": {
            "Run_a_query_against_a_dataset_-_A_to_H": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000026"
          },
          "type": "Table",
          "inputs": {
            "from": "@outputs('Run_a_query_against_a_dataset_-_A_to_H')?['body/firstTableRows']",
            "format": "CSV"
          }
        },
        "Run_a_query_against_a_dataset_-_I_to_L": {
          "runAfter": {
            "Create_CSV_table_-_A_to_H": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000027"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "groupid": "<POWERBI_WORKSPACE_ID>",
              "datasetid": "<POWERBI_DATASET_ID>",
              "specification/query": "DEFINE\nVAR __DS0Core =\n SELECTCOLUMNS (\n KEEPFILTERS (\n FILTER (\n KEEPFILTERS (\n SUMMARIZECOLUMNS (\n 'Applications'[app.name],\n 'Applications'[app.vendorName],\n 'Intune_Device'[deviceName],\n 'Agents'[agent.lastLoggedInUser],\n 'Agents'[resourceType],\n 'Agents'[serialNumber],\n 'Agents'[lastActiveDt],\n 'Agents'[lastRebootDt],\n\n /* Site Filter */\n KEEPFILTERS (\n FILTER (\n ALL ( 'Agents'[s1SiteName] ),\n TRIM ( 'Agents'[s1SiteName] ) = \"<S1_SITE_NAME>\"\n )\n ),\n\n /* OS Filter */\n KEEPFILTERS (\n FILTER (\n ALL ( 'Agents'[resourceType] ),\n TRIM ( 'Agents'[resourceType] ) = \"Windows laptop\"\n )\n ),\n\n /* Device Name Filter: XX-I to XX-L */\n\t\t\t\t\t\tKEEPFILTERS (\n\t\t\t\t\t\t\tFILTER (\n\t\t\t\t\t\t\t\tALL ( 'Intune_Device'[deviceName] ),\n\t\t\t\t\t\t\t\tVAR PrefixChar =\n\t\t\t\t\t\t\t\t\tMID (\n\t\t\t\t\t\t\t\t\t\tUPPER ( TRIM ( 'Intune_Device'[deviceName] ) ),\n\t\t\t\t\t\t\t\t\t\t4,\n\t\t\t\t\t\t\t\t\t\t1\n\t\t\t\t\t\t\t\t\t)\n\t\t\t\t\t\t\t\tRETURN\n\t\t\t\t\t\t\t\t\t(\n\t\t\t\t\t\t\t\t\t\tPrefixChar >= \"I\"\n\t\t\t\t\t\t\t\t\t\t\t&& PrefixChar <= \"L\"\n\t\t\t\t\t\t\t\t\t)\n\t\t\t\t\t\t\t)\n\t\t\t\t\t\t),\n \"CountRowsApplications\", COUNTROWS ( 'Applications' ),\n \"CountRowsAgents\", COUNTROWS ( 'Agents' )\n )\n ),\n OR (\n NOT ( ISBLANK ( 'Applications'[app.name] ) ),\n NOT ( ISBLANK ( 'Intune_Device'[deviceName] ) )\n )\n )\n ),\n\n /* Output Columns */\n \"App_Name\", 'Applications'[app.name],\n \"Publisher\", 'Applications'[app.vendorName],\n \"Computer_Name\", 'Intune_Device'[deviceName],\n \"User_Name\", 'Agents'[agent.lastLoggedInUser],\n \"OS_Name\", 'Agents'[resourceType],\n \"Serial_Number\", 'Agents'[serialNumber],\n \"Last_Active\", 'Agents'[lastActiveDt],\n \"Last_Reboot\", 'Agents'[lastRebootDt]\n )\n\nEVALUATE\n __DS0Core\n\nORDER BY\n [Computer_Name],\n [Publisher],\n [OS_Name],\n [App_Name],\n [User_Name],\n [Serial_Number],\n [Last_Active],\n [Last_Reboot]",
              "specification/serializerSettings/includeNulls": false
            },
            "host": {
              "connectionName": "shared_powerbi",
              "operationId": "ExecuteDatasetQuery",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_powerbi"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Get data from Power BI dashboard S1 -> All Apps"
        },
        "Create_CSV_table_-_I_to_L": {
          "runAfter": {
            "Run_a_query_against_a_dataset_-_I_to_L": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000028"
          },
          "type": "Table",
          "inputs": {
            "from": "@outputs('Run_a_query_against_a_dataset_-_I_to_L')?['body/firstTableRows']",
            "format": "CSV"
          }
        },
        "Run_a_query_against_a_dataset_-_M_to_Z": {
          "runAfter": {
            "Create_CSV_table_-_I_to_L": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000029"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "groupid": "<POWERBI_WORKSPACE_ID>",
              "datasetid": "<POWERBI_DATASET_ID>",
              "specification/query": "DEFINE\nVAR __DS0Core =\n SELECTCOLUMNS (\n KEEPFILTERS (\n FILTER (\n KEEPFILTERS (\n SUMMARIZECOLUMNS (\n 'Applications'[app.name],\n 'Applications'[app.vendorName],\n 'Intune_Device'[deviceName],\n 'Agents'[agent.lastLoggedInUser],\n 'Agents'[resourceType],\n 'Agents'[serialNumber],\n 'Agents'[lastActiveDt],\n 'Agents'[lastRebootDt],\n\n /* Site Filter */\n KEEPFILTERS (\n FILTER (\n ALL ( 'Agents'[s1SiteName] ),\n TRIM ( 'Agents'[s1SiteName] ) = \"<S1_SITE_NAME>\"\n )\n ),\n\n /* OS Filter */\n KEEPFILTERS (\n FILTER (\n ALL ( 'Agents'[resourceType] ),\n TRIM ( 'Agents'[resourceType] ) = \"Windows laptop\"\n )\n ),\n\n /* Device Name Filter: XX-M to XX-Z */\n\t\t\t\t\t\tKEEPFILTERS (\n\t\t\t\t\t\t\tFILTER (\n\t\t\t\t\t\t\t\tALL ( 'Intune_Device'[deviceName] ),\n\t\t\t\t\t\t\t\tVAR PrefixChar =\n\t\t\t\t\t\t\t\t\tMID (\n\t\t\t\t\t\t\t\t\t\tUPPER ( TRIM ( 'Intune_Device'[deviceName] ) ),\n\t\t\t\t\t\t\t\t\t\t4,\n\t\t\t\t\t\t\t\t\t\t1\n\t\t\t\t\t\t\t\t\t)\n\t\t\t\t\t\t\t\tRETURN\n\t\t\t\t\t\t\t\t\t(\n\t\t\t\t\t\t\t\t\t\tPrefixChar >= \"M\"\n\t\t\t\t\t\t\t\t\t\t\t&& PrefixChar <= \"Z\"\n\t\t\t\t\t\t\t\t\t)\n\t\t\t\t\t\t\t)\n\t\t\t\t\t\t),\n \"CountRowsApplications\", COUNTROWS ( 'Applications' ),\n \"CountRowsAgents\", COUNTROWS ( 'Agents' )\n )\n ),\n OR (\n NOT ( ISBLANK ( 'Applications'[app.name] ) ),\n NOT ( ISBLANK ( 'Intune_Device'[deviceName] ) )\n )\n )\n ),\n\n /* Output Columns */\n \"App_Name\", 'Applications'[app.name],\n \"Publisher\", 'Applications'[app.vendorName],\n \"Computer_Name\", 'Intune_Device'[deviceName],\n \"User_Name\", 'Agents'[agent.lastLoggedInUser],\n \"OS_Name\", 'Agents'[resourceType],\n \"Serial_Number\", 'Agents'[serialNumber],\n \"Last_Active\", 'Agents'[lastActiveDt],\n \"Last_Reboot\", 'Agents'[lastRebootDt]\n )\n\nEVALUATE\n __DS0Core\n\nORDER BY\n [Computer_Name],\n [Publisher],\n [OS_Name],\n [App_Name],\n [User_Name],\n [Serial_Number],\n [Last_Active],\n [Last_Reboot]",
              "specification/serializerSettings/includeNulls": false
            },
            "host": {
              "connectionName": "shared_powerbi",
              "operationId": "ExecuteDatasetQuery",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_powerbi"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Get data from Power BI dashboard S1 -> All Apps"
        },
        "Create_CSV_table_-_M_to_Z": {
          "runAfter": {
            "Run_a_query_against_a_dataset_-_M_to_Z": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000030"
          },
          "type": "Table",
          "inputs": {
            "from": "@outputs('Run_a_query_against_a_dataset_-_M_to_Z')?['body/firstTableRows']",
            "format": "CSV"
          }
        },
        "Run_a_query_against_a_dataset_-_other": {
          "runAfter": {
            "Create_CSV_table_-_M_to_Z": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000031"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "groupid": "<POWERBI_WORKSPACE_ID>",
              "datasetid": "<POWERBI_DATASET_ID>",
              "specification/query": "DEFINE\nVAR __DS0Core =\n SELECTCOLUMNS (\n KEEPFILTERS (\n FILTER (\n KEEPFILTERS (\n SUMMARIZECOLUMNS (\n 'Applications'[app.name],\n 'Applications'[app.vendorName],\n 'Intune_Device'[deviceName],\n 'Agents'[agent.lastLoggedInUser],\n 'Agents'[resourceType],\n 'Agents'[serialNumber],\n 'Agents'[lastActiveDt],\n 'Agents'[lastRebootDt],\n\n /* Site Filter */\n KEEPFILTERS (\n FILTER (\n ALL ( 'Agents'[s1SiteName] ),\n TRIM ( 'Agents'[s1SiteName] ) = \"<S1_SITE_NAME>\"\n )\n ),\n\t\t\t\t\t\t/* OS Filter */\n\t\t\t\t\t\tKEEPFILTERS (\n\t\t\t\t\t\t\tFILTER (\n\t\t\t\t\t\t\t\tALL ( 'Agents'[resourceType] ),\n\t\t\t\t\t\t\t\tTRIM ( 'Agents'[resourceType] ) IN {\n\t\t\t\t\t\t\t\t\t\"Windows desktop\",\n\t\t\t\t\t\t\t\t\t\"Windows workstation\",\n\t\t\t\t\t\t\t\t\t\"macOS laptop\",\n\t\t\t\t\t\t\t\t\t\"macOS desktop\"\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t)\n\t\t\t\t\t\t),\n \"CountRowsApplications\", COUNTROWS ( 'Applications' ),\n \"CountRowsAgents\", COUNTROWS ( 'Agents' )\n )\n ),\n OR (\n NOT ( ISBLANK ( 'Applications'[app.name] ) ),\n NOT ( ISBLANK ( 'Intune_Device'[deviceName] ) )\n )\n )\n ),\n\n /* Output Columns */\n \"App_Name\", 'Applications'[app.name],\n \"Publisher\", 'Applications'[app.vendorName],\n \"Computer_Name\", 'Intune_Device'[deviceName],\n \"User_Name\", 'Agents'[agent.lastLoggedInUser],\n \"OS_Name\", 'Agents'[resourceType],\n \"Serial_Number\", 'Agents'[serialNumber],\n \"Last_Active\", 'Agents'[lastActiveDt],\n \"Last_Reboot\", 'Agents'[lastRebootDt]\n )\n\nEVALUATE\n __DS0Core\n\nORDER BY\n [Computer_Name],\n [Publisher],\n [OS_Name],\n [App_Name],\n [User_Name],\n [Serial_Number],\n [Last_Active],\n [Last_Reboot]",
              "specification/serializerSettings/includeNulls": false
            },
            "host": {
              "connectionName": "shared_powerbi",
              "operationId": "ExecuteDatasetQuery",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_powerbi"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Get data from Power BI dashboard S1 -> All Apps"
        },
        "Create_CSV_table_-_other": {
          "runAfter": {
            "Run_a_query_against_a_dataset_-_other": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000032"
          },
          "type": "Table",
          "inputs": {
            "from": "@outputs('Run_a_query_against_a_dataset_-_other')?['body/firstTableRows']",
            "format": "CSV"
          }
        },
        "Compose_2": {
          "runAfter": {
            "Create_CSV_table_-_other": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000033"
          },
          "type": "Compose",
          "inputs": "@concat(\r\n trim(\r\n join(\r\n skip(\r\n split(\r\n trim(body('Create_CSV_table_-_I_to_L')),\r\n decodeUriComponent('%0A')\r\n ),\r\n 1\r\n ),\r\n decodeUriComponent('%0A')\r\n )\r\n ),\r\n decodeUriComponent('%0A'),\r\n trim(\r\n join(\r\n skip(\r\n split(\r\n trim(body('Create_CSV_table_-_M_to_Z')),\r\n decodeUriComponent('%0A')\r\n ),\r\n 1\r\n ),\r\n decodeUriComponent('%0A')\r\n )\r\n ),\r\n decodeUriComponent('%0A'),\r\n trim(\r\n join(\r\n skip(\r\n split(\r\n trim(body('Create_CSV_table_-_other')),\r\n decodeUriComponent('%0A')\r\n ),\r\n 1\r\n ),\r\n decodeUriComponent('%0A')\r\n )\r\n )\r\n)"
        },
        "Compose_1_1": {
          "runAfter": {
            "Compose_2": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000034"
          },
          "type": "Compose",
          "inputs": "@replace(\r\n replace(\r\n concat(\r\n trim(body('Create_CSV_table_-_A_to_H')),\r\n decodeUriComponent('%0A'),\r\n trim(outputs('Compose_2'))\r\n ),\r\n concat(\r\n decodeUriComponent('%0D'),\r\n decodeUriComponent('%0A'),\r\n decodeUriComponent('%0D'),\r\n decodeUriComponent('%0A')\r\n ),\r\n concat(\r\n decodeUriComponent('%0D'),\r\n decodeUriComponent('%0A')\r\n )\r\n ),\r\n concat(\r\n decodeUriComponent('%0A'),\r\n decodeUriComponent('%0A')\r\n ),\r\n decodeUriComponent('%0A')\r\n)"
        },
        "Create_file_1": {
          "runAfter": {
            "Compose_1_1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000035"
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "dataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "folderPath": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>",
              "name": "S1_All_Apps.csv",
              "body": "@outputs('Compose_1_1')"
            },
            "host": {
              "connectionName": "shared_sharepointonline",
              "operationId": "CreateFile",
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Create file include all S1 apps from Power BI",
          "runtimeConfiguration": {
            "contentTransfer": {
              "transferMode": "Chunked"
            }
          }
        },
        "Compose_AllApps": {
          "runAfter": {
            "Create_file_1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000036"
          },
          "type": "Compose",
          "inputs": "@\r\nunion(\r\n union(\r\n body('Run_a_query_against_a_dataset_-_A_to_H')?['results'][0]?['tables'][0]?['rows'],\r\n body('Run_a_query_against_a_dataset_-_I_to_L')?['results'][0]?['tables'][0]?['rows']\r\n ),\r\n union(\r\n body('Run_a_query_against_a_dataset_-_M_to_Z')?['results'][0]?['tables'][0]?['rows'],\r\n body('Run_a_query_against_a_dataset_-_other')?['results'][0]?['tables'][0]?['rows']\r\n )\r\n)\r\n"
        },
        "Compose_Half1": {
          "runAfter": {
            "Compose_AllApps": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000037"
          },
          "type": "Compose",
          "inputs": "@take(outputs('Compose_AllApps'), div(length(outputs('Compose_AllApps')), 2))",
          "description": "Get 1/2 rows list of S1_All_Apps.csv file"
        },
        "Compose_Half2": {
          "runAfter": {
            "Compose_Half1": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000038"
          },
          "type": "Compose",
          "inputs": "@skip(outputs('Compose_AllApps'), div(length(outputs('Compose_AllApps')), 2))",
          "description": "Get other 1/2 rows list of S1_All_Apps.csv file"
        },
        "Apply_to_each_1": {
          "foreach": "@outputs('Compose_Half2')",
          "actions": {
            "Condition_2": {
              "actions": {
                "Add_a_row_into_a_table_2": {
                  "runAfter": {},
                  "metadata": {
                    "operationMetadataId": "00000000-0000-0000-0000-000000000039"
                  },
                  "type": "OpenApiConnection",
                  "inputs": {
                    "parameters": {
                      "source": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
                      "drive": "<DRIVE_ID>",
                      "file": "/Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Apps_Exclude_Software_Catalog.xlsx",
                      "table": "{<TABLE_ID_APPS_EXCLUDE>}",
                      "item/App_Name": "@items('Apply_to_each_1')?['[App_Name]']",
                      "item/Publisher": "@items('Apply_to_each_1')?['[Publisher]']",
                      "item/Computer_Name": "@items('Apply_to_each_1')?['[Computer_Name]']",
                      "item/User_Name": "@items('Apply_to_each_1')?['[User_Name]']",
                      "item/OS_Name": "@items('Apply_to_each_1')?['[OS_Name]']",
                      "item/Last_Active": "@items('Apply_to_each_1')?['[Last_Active]']",
                      "item/Last_Reboot": "@items('Apply_to_each_1')?['[Last_Reboot]']",
                      "item/Date_Time": "@formatDateTime(utcNow(),'yyyy-MM-dd HH:mm:ss.fff')"
                    },
                    "host": {
                      "connectionName": "shared_excelonlinebusiness",
                      "operationId": "AddRowV2",
                      "apiId": "/providers/Microsoft.PowerApps/apis/shared_excelonlinebusiness"
                    },
                    "authentication": "@parameters('$authentication')"
                  },
                  "description": "Add app not in Software Catalog to Excel file"
                }
              },
              "runAfter": {
                "Filter_array_1": [
                  "Succeeded"
                ]
              },
              "expression": {
                "and": [
                  {
                    "equals": [
                      "@equals(length(body('Filter_array_1')), 0)",
                      "@true"
                    ]
                  }
                ]
              },
              "metadata": {
                "operationMetadataId": "00000000-0000-0000-0000-000000000040"
              },
              "type": "If",
              "description": "If the AppName into S1 All App have in Software Catalog -> True"
            },
            "Filter_array_1": {
              "runAfter": {},
              "metadata": {
                "operationMetadataId": "00000000-0000-0000-0000-000000000041"
              },
              "type": "Query",
              "inputs": {
                "from": "@variables('varSoftwareMapping')",
                "where": "@and(\r\n contains(\r\n toLower(trim(string(coalesce(item()?['Software_Mapping'], '')))), \r\n toLower(trim(string(coalesce(items('Apply_to_each_1')?['[App_Name]'], ''))))\r\n ),\r\n contains(\r\n toLower(trim(string(coalesce(item()?['Brand_Mapping'], '')))),\r\n toLower(trim(string(coalesce(items('Apply_to_each_1')?['[Publisher]'], ''))))\r\n )\r\n)"
              },
              "description": "Check AppName into S1 All Apps have or contain name with Software Catalog"
            }
          },
          "runAfter": {
            "Apply_to_each": [
              "Succeeded"
            ]
          },
          "metadata": {
            "operationMetadataId": "00000000-0000-0000-0000-000000000042"
          },
          "type": "Foreach",
          "description": "For each 1/2 other app into S1 All Apps"
        }
      }
    },
    "templateName": ""
  },
  "schemaVersion": "1.0.0.0"
}
```

## Bước 6-7: License Team duyệt và gửi mail cho user

Không phải app nào ngoài Catalog cũng phải gỡ. License Team duyệt từng app với một trong ba quyết định:

| Quyết định | Hành động tiếp theo |
|---|---|
| **Uninstall** | Đưa vào danh sách gỡ, gửi mail user, deploy script |
| **Add to Catalog** | Cập nhật Software Catalog, lần chạy sau tự hết |
| **Exception** | Giữ lại cho user/máy cụ thể, ghi lý do và thời hạn |

Sau khi có danh sách **Uninstall**, flow gom theo `User Name` để **mỗi user chỉ nhận một email**, liệt kê tất cả app trên máy của họ:

```text
Subject: [IT Notice] Phần mềm không được phép trên máy {Device Name} sẽ được gỡ bỏ

Chào anh/chị {User Name},

Theo chính sách phần mềm của công ty, các ứng dụng sau trên máy {Device Name}
không nằm trong Software Catalog và sẽ được tự động gỡ bỏ sau {N} ngày làm việc:

- {App Name} ({App Brand})

Nếu anh/chị cần sử dụng phần mềm này cho công việc, vui lòng tạo ticket
yêu cầu cấp phép trước ngày {Deadline}.

Trân trọng,
IT Team
```

### Script / flow của mình

```text
{
  "properties": {
    "connectionReferences": {
      "shared_office365-1": {
        "runtimeSource": "embedded",
        "connection": {
          "connectionReferenceLogicalName": "<PREFIX>_sharedoffice365_<ID>"
        },
        "api": {
          "name": "shared_office365"
        }
      },
      "shared_excelonlinebusiness": {
        "runtimeSource": "embedded",
        "connection": {
          "connectionReferenceLogicalName": "<PREFIX>_sharedexcelonlinebusiness_<ID>"
        },
        "api": {
          "name": "shared_excelonlinebusiness"
        }
      },
      "shared_sharepointonline": {
        "runtimeSource": "embedded",
        "connection": {
          "connectionReferenceLogicalName": "<PREFIX>_sharedsharepointonline_<ID>"
        },
        "api": {
          "name": "shared_sharepointonline"
        }
      }
    },
    "definition": {
      "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      "contentVersion": "undefined",
      "parameters": {
        "$authentication": {
          "defaultValue": {},
          "type": "SecureObject"
        },
        "$connections": {
          "defaultValue": {},
          "type": "Object"
        }
      },
      "triggers": {
        "Recurrence": {
          "recurrence": {
            "frequency": "Month",
            "interval": 1,
            "startTime": "2026-05-28T08:00:00Z",
            "timeZone": "SE Asia Standard Time"
          },
          "evaluatedRecurrence": {
            "frequency": "Month",
            "interval": 1,
            "startTime": "2026-05-28T08:00:00Z",
            "timeZone": "SE Asia Standard Time"
          },
          "type": "Recurrence"
        }
      },
      "actions": {
        "Filter_array": {
          "runAfter": {
            "List_rows_present_in_a_table": [
              "Succeeded"
            ]
          },
          "type": "Query",
          "inputs": {
            "from": "@outputs('List_rows_present_in_a_table')?['body/value']",
            "where": "@equals(item()?['Approve_Uninstall'],'Yes')"
          }
        },
        "Select_2": {
          "runAfter": {
            "Filter_array_2": [
              "Succeeded"
            ]
          },
          "type": "Select",
          "inputs": {
            "from": "@body('Filter_array_2')",
            "select": "@trim(string(item()?['App_Name']))"
          },
          "description": "Only get the App_Name"
        },
        "Compose": {
          "runAfter": {
            "Select_2": [
              "Succeeded"
            ]
          },
          "type": "Compose",
          "inputs": "@union(\r\n coalesce(body('Select_2'), createArray()),\r\n coalesce(body('Select_2'), createArray())\r\n)",
          "description": "Remove duplicate app"
        },
        "Compose_2": {
          "runAfter": {
            "Compose": [
              "Succeeded"
            ]
          },
          "type": "Compose",
          "inputs": "@if(\r\n equals(length(outputs('Compose')), 0),\r\n '',\r\n concat(\r\n ' \"',\r\n join(\r\n outputs('Compose'),\r\n concat('\",', decodeUriComponent('%0D%0A'), ' \"')\r\n ),\r\n '\"'\r\n )\r\n)",
          "description": "edit the format \"App_Name\","
        },
        "Select": {
          "runAfter": {
            "Filter_array_2": [
              "Succeeded"
            ]
          },
          "type": "Select",
          "inputs": {
            "from": "@body('Filter_array_2')",
            "select": "@item()?['User_Name']"
          },
          "description": "Only get the User_Name"
        },
        "Compose_1": {
          "runAfter": {
            "Select": [
              "Succeeded"
            ]
          },
          "type": "Compose",
          "inputs": "@union(\r\n coalesce(body('Select'), createArray()),\r\n coalesce(body('Select'), createArray())\r\n)",
          "description": "Remove duplicate User"
        },
        "Apply_to_each": {
          "foreach": "@outputs('Compose_1')",
          "actions": {
            "Filter_array_1": {
              "type": "Query",
              "inputs": {
                "from": "@body('Filter_array_2')",
                "where": "@equals(\r\n trim(item()?['User_Name']),\r\n trim(items('Apply_to_each'))\r\n)\r\n"
              }
            },
            "Select_1": {
              "runAfter": {
                "Filter_array_1": [
                  "Succeeded"
                ]
              },
              "type": "Select",
              "inputs": {
                "from": "@body('Filter_array_1')",
                "select": "@trim(string(item()?['App_Name']))"
              },
              "description": "Get App per User"
            },
            "Compose_4": {
              "runAfter": {
                "Select_1": [
                  "Succeeded"
                ]
              },
              "type": "Compose",
              "inputs": "@concat(\r\n '- ',\r\n join(body('Select_1'), '<br>- ')\r\n)",
              "description": "App List, show all apps related to user"
            },
            "Compose_5": {
              "runAfter": {
                "Compose_4": [
                  "Succeeded"
                ]
              },
              "type": "Compose",
              "inputs": "@first(body('Filter_array_1'))?['Computer_Name']",
              "description": "Get Device_Name"
            },
            "Send_an_email_from_a_shared_mailbox_(V2)": {
              "runAfter": {
                "Compose_5": [
                  "Succeeded"
                ]
              },
              "type": "OpenApiConnection",
              "inputs": {
                "parameters": {
                  "emailMessage/MailboxAddress": "<SHARED_MAILBOX>@contoso.com",
                  "emailMessage/To": "@concat(items('Apply_to_each'), '@contoso.com')",
                  "emailMessage/Subject": "Notification: Unverified Software Detected on Your Device ",
                  "emailMessage/Body": "<p class=\"editor-paragraph\">Dear @{items('Apply_to_each')},<br><br>We have detected unverified software (not listed in the Software Catalog) installed on your device @{outputs('Compose_5')}.<br><br>@{outputs('Compose_4')}<br><br>To ensure compliance with IT software policy, this software will be uninstalled within (1) day after you receive this notification.<br><br>If you need this software for your work or have any questions, please contact IT License team for further review and support.<br><br>Thank you for your understanding and cooperation.<br><br>Best regards,<br>IT License Team</p>",
                  "emailMessage/Importance": "Normal"
                },
                "host": {
                  "apiId": "/providers/Microsoft.PowerApps/apis/shared_office365",
                  "connectionName": "shared_office365-1",
                  "operationId": "SharedMailboxSendEmailV2"
                },
                "authentication": "@parameters('$authentication')"
              }
            }
          },
          "runAfter": {
            "Compose_1": [
              "Succeeded"
            ]
          },
          "type": "Foreach",
          "description": "For each User"
        },
        "Filter_array_2": {
          "runAfter": {
            "Filter_array": [
              "Succeeded"
            ]
          },
          "type": "Query",
          "inputs": {
            "from": "@body('Filter_array')",
            "where": "@startsWith(toLower(item()?['OS_Name']),'Windows')"
          },
          "description": "For Windows: Create .ps1 file and Send email to user"
        },
        "Filter_array_3": {
          "runAfter": {
            "Filter_array": [
              "Succeeded"
            ]
          },
          "type": "Query",
          "inputs": {
            "from": "@body('Filter_array')",
            "where": "@startsWith(toLower(item()?['OS_Name']),'macOS')"
          },
          "description": "For MacOS: Create .sh file and Send email to user"
        },
        "Select_2_1": {
          "runAfter": {
            "Filter_array_3": [
              "Succeeded"
            ]
          },
          "type": "Select",
          "inputs": {
            "from": "@body('Filter_array_3')",
            "select": "@trim(string(item()?['App_Name']))"
          },
          "description": "Only get the App_Name"
        },
        "Select_3": {
          "runAfter": {
            "Filter_array_3": [
              "Succeeded"
            ]
          },
          "type": "Select",
          "inputs": {
            "from": "@body('Filter_array_3')",
            "select": "@item()?['User_Name']"
          },
          "description": "Only get the User_Name"
        },
        "Compose_6": {
          "runAfter": {
            "Select_2_1": [
              "Succeeded"
            ]
          },
          "type": "Compose",
          "inputs": "@union(\r\n coalesce(body('Select_2_1'), createArray()),\r\n coalesce(body('Select_2_1'), createArray())\r\n)",
          "description": "Remove duplicate app"
        },
        "Compose_2_1": {
          "runAfter": {
            "Compose_6": [
              "Succeeded"
            ]
          },
          "type": "Compose",
          "inputs": "@if(\r\n equals(length(outputs('Compose_6')), 0),\r\n '',\r\n concat(\r\n ' \"',\r\n join(\r\n outputs('Compose_6'),\r\n concat('\",', decodeUriComponent('%0D%0A'), ' \"')\r\n ),\r\n '\"'\r\n )\r\n)",
          "description": "edit the format \"App_Name\","
        },
        "Compose_3_1": {
          "runAfter": {
            "Compose_2_1": [
              "Succeeded"
            ]
          },
          "type": "Compose",
          "inputs": "#!/bin/bash\n\nLOG_FILE='/var/tmp/uninstall_apps.log'\necho \"Uninstall process started at $(date)\" >> \"$LOG_FILE\"\n\napps=(\n @{outputs('Compose_2_1')}\n)\n\n# Detect current logged-in user\nCURRENT_USER=$(stat -f \"%Su\" /dev/console)\nUSER_APP_DIR=\"/Users/$CURRENT_USER/Applications\"\n\nfor app in \"${apps[@]}\"; do\n\techo \"Checking for $app...\" | tee -a \"$LOG_FILE\"\n\n\t# Check and remove from /Applications\n\tif [ -d \"/Applications/$app.app\" ]; then\n\t\techo \"Uninstalling $app from /Applications...\" | tee -a \"$LOG_FILE\"\n\t\tsudo pkill -f \"$app\" 2>/dev/null\n\t\tsudo rm -rf \"/Applications/$app.app\"\n\t\techo \"$app removed from /Applications.\" | tee -a \"$LOG_FILE\"\n\tfi\n\n\t# Check and remove from user-specific Applications folder\n\tif [ -d \"$USER_APP_DIR/$app.app\" ]; then\n\t\techo \"Uninstalling $app from $USER_APP_DIR...\" | tee -a \"$LOG_FILE\"\n\t\tpkill -f \"$app\" 2>/dev/null\n\t\trm -rf \"$USER_APP_DIR/$app.app\"\n\t\techo \"$app removed from $USER_APP_DIR.\" | tee -a \"$LOG_FILE\"\n\tfi\n\n\t# ===== Remove Maxon Cinema 4D version folders (delete folder + all contents) =====\n\tshopt -s nullglob\n\tfor c4d_dir in /Applications/Maxon\\ Cinema\\ 4D*; do\n\t if [ -d \"$c4d_dir\" ]; then\n\t\techo \"Removing folder: $c4d_dir\" | tee -a \"$LOG_FILE\"\n\t\tsudo pkill -f \"Cinema 4D\" 2>/dev/null || true\n\t\tsudo pkill -f \"c4d\" 2>/dev/null || true\n\t\tsudo rm -rf \"$c4d_dir\"\n\t\techo \"Removed: $c4d_dir\" | tee -a \"$LOG_FILE\"\n\t fi\n\tdone\n\tshopt -u nullglob\n\n\t# ===== Remove AEJuice version folders (delete folder + all contents) =====\n\tshopt -s nullglob\n\tfor AEJuice_dir in /Library/Application Support/AEJuice; do\n\t if [ -d \"$AEJuice_dir\" ]; then\n\t\techo \"Removing folder: $AEJuice_dir\" | tee -a \"$LOG_FILE\"\n\t\tsudo pkill -f \"Cinema 4D\" 2>/dev/null || true\n\t\tsudo rm -rf \"$AEJuice_dir\"\n\t\techo \"Removed: $AEJuice_dir\" | tee -a \"$LOG_FILE\"\n\t fi\n\tdone\n\tfor AEJuice_dir1 in /Application/AEJuice; do\n\t if [ -d \"$AEJuice_dir1\" ]; then\n\t\techo \"Removing folder: $AEJuice_dir1\" | tee -a \"$LOG_FILE\"\n\t\tsudo pkill -f \"AEJuice\" 2>/dev/null || true\n\t\tsudo rm -rf \"$AEJuice_dir1\"\n\t\techo \"Removed: $AEJuice_dir1\" | tee -a \"$LOG_FILE\"\n\t fi\n\tdone\n\tshopt -u nullglob\n\n\t# Remove related Library files\n\tif [ -d \"$HOME/Library/Application Support/$app\" ]; then\n\trm -rf \"$HOME/Library/Application Support/$app\"\n\tfi\n\tif [ -d \"$HOME/Library/Caches/$app\" ]; then\n\trm -rf \"$HOME/Library/Caches/$app\"\n\tfi\n\tif [ -f \"$HOME/Library/Preferences/com.${app// /}.plist\" ]; then\n\trm -f \"$HOME/Library/Preferences/com.${app// /}.plist\"\n\tfi\n\tif [ -f \"/Users/$CURRENT_USER/Library/Application Support/$app\" ]; then\n\trm -rf \"/Users/$CURRENT_USER/Library/Application Support/$app\"\n\tfi\n\n\techo \"$app cleanup completed.\" | tee -a \"$LOG_FILE\"\n\techo \"\" >> \"$LOG_FILE\"\ndone\n\necho \"Uninstall process finished at $(date)\" >> \"$LOG_FILE\"\n\n",
          "description": "Add the App_Name to Full script Uninstall apps"
        },
        "Compose_1_1": {
          "runAfter": {
            "Select_3": [
              "Succeeded"
            ]
          },
          "type": "Compose",
          "inputs": "@union(\r\n coalesce(body('Select_3'), createArray()),\r\n coalesce(body('Select_3'), createArray())\r\n)",
          "description": "Remove duplicate User"
        },
        "Apply_to_each_1": {
          "foreach": "@outputs('Compose_1_1')",
          "actions": {
            "Filter_array_1_1": {
              "type": "Query",
              "inputs": {
                "from": "@body('Filter_array_3')",
                "where": "@equals(trim(item()?['User_Name']),trim(items('Apply_to_each_1')))"
              }
            },
            "Select_1_1": {
              "runAfter": {
                "Filter_array_1_1": [
                  "Succeeded"
                ]
              },
              "type": "Select",
              "inputs": {
                "from": "@body('Filter_array_1_1')",
                "select": "@trim(string(item()?['App_Name']))"
              },
              "description": "Get App per User"
            },
            "Compose_4_1": {
              "runAfter": {
                "Select_1_1": [
                  "Succeeded"
                ]
              },
              "type": "Compose",
              "inputs": "@concat(\r\n '- ',\r\n join(body('Select_1_1'), '<br>- ')\r\n)",
              "description": "App List, show all apps related to user"
            },
            "Compose_5_1": {
              "runAfter": {
                "Compose_4_1": [
                  "Succeeded"
                ]
              },
              "type": "Compose",
              "inputs": "@first(body('Filter_array_1_1'))?['Computer_Name']",
              "description": "Get Device_Name"
            },
            "Send_an_email_from_a_shared_mailbox_(V2)_1": {
              "runAfter": {
                "Compose_5_1": [
                  "Succeeded"
                ]
              },
              "type": "OpenApiConnection",
              "inputs": {
                "parameters": {
                  "emailMessage/MailboxAddress": "<SHARED_MAILBOX>@contoso.com",
                  "emailMessage/To": "@concat(items('Apply_to_each_1'), '@contoso.com')",
                  "emailMessage/Subject": "Notification: Unverified Software Detected on Your Device ",
                  "emailMessage/Body": "<p class=\"editor-paragraph\">Dear @{items('Apply_to_each_1')},<br><br>We have detected unverified software (not listed in the Software Catalog) installed on your device @{outputs('Compose_5_1')}.<br><br>@{outputs('Compose_4_1')}<br><br>To ensure compliance with IT software policy, this software will be uninstalled within (1) day after you receive this notification.<br><br>If you need this software for your work or have any questions, please contact IT License team for further review and support.<br><br>Thank you for your understanding and cooperation.<br><br>Best regards,<br>IT License Team</p>",
                  "emailMessage/Importance": "Normal"
                },
                "host": {
                  "apiId": "/providers/Microsoft.PowerApps/apis/shared_office365",
                  "connectionName": "shared_office365-1",
                  "operationId": "SharedMailboxSendEmailV2"
                },
                "authentication": "@parameters('$authentication')"
              }
            }
          },
          "runAfter": {
            "Compose_1_1": [
              "Succeeded"
            ]
          },
          "type": "Foreach"
        },
        "List_rows_present_in_a_table": {
          "runAfter": {},
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "source": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "drive": "<DRIVE_ID>",
              "file": "/Documents/<ROOT_FOLDER>/<DATA_FOLDER>/Apps_Exclude_Software_Catalog.xlsx",
              "table": "{<TABLE_ID_APPS_EXCLUDE>}"
            },
            "host": {
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_excelonlinebusiness",
              "connectionName": "shared_excelonlinebusiness",
              "operationId": "GetItems"
            },
            "authentication": "@parameters('$authentication')"
          },
          "description": "Get the list app not in Software Catalog (Need to Uninstall)",
          "runtimeConfiguration": {
            "paginationPolicy": {
              "minimumItemCount": 3000
            }
          }
        },
        "Create_file": {
          "runAfter": {
            "Compose_3": [
              "Succeeded"
            ]
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "dataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "folderPath": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>",
              "name": "Remove_App.ps1",
              "body": "@outputs('Compose_3')"
            },
            "host": {
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
              "connectionName": "shared_sharepointonline",
              "operationId": "CreateFile"
            },
            "authentication": "@parameters('$authentication')"
          },
          "runtimeConfiguration": {
            "contentTransfer": {
              "transferMode": "Chunked"
            }
          }
        },
        "Create_file_1": {
          "runAfter": {
            "Compose_3_1": [
              "Succeeded"
            ]
          },
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "dataset": "https://contoso.sharepoint.com/sites/<SITE_NAME>",
              "folderPath": "/Shared Documents/<ROOT_FOLDER>/<DATA_FOLDER>",
              "name": "Remove_App_MacOS.sh",
              "body": "@outputs('Compose_3_1')"
            },
            "host": {
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
              "connectionName": "shared_sharepointonline",
              "operationId": "CreateFile"
            },
            "authentication": "@parameters('$authentication')"
          },
          "runtimeConfiguration": {
            "contentTransfer": {
              "transferMode": "Chunked"
            }
          }
        },
        "Compose_3": {
          "runAfter": {
            "Compose_2": [
              "Succeeded"
            ]
          },
          "type": "Compose",
          "inputs": "If ($null -eq (Get-PSDrive -Name HKU -ErrorAction SilentlyContinue)) {\n $null = New-PSDrive -PSProvider Registry -Name HKU -Root HKEY_USERS\n}\n\n$HKUsers = Get-ChildItem \"HKU:\\\" -ea SilentlyContinue | Select-Object -ExpandProperty Name | Split-Path -Leaf\n$DirectoryUsers = Get-ChildItem \"C:\\Users\" -ea SilentlyContinue | Select-Object -ExpandProperty Name\n\n$AppNameList = @(\n@{outputs('Compose_2')}\n)\n$ProgramPaths = @(\n \"C:\\Program Files\",\n \"C:\\Program Files (x86)\",\n \"C:\\ProgramData\",\n \"C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\",\n \"C:\\Users\\Public\\Desktop\"\n)\n\n$HKLM = @(\n \"HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\",\n \"HKLM:\\SOFTWARE\\wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\",\n \"HKLM:\\SOFTWARE\\Classes\\Installer\\Products\"\n)\n\n$HKCU = @(\n \"HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\",\n \"HKCU:\\SOFTWARE\\wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\"\n)\n\nforeach ($AppName in $AppNameList) {\n Write-Host \"===============================\"\n Write-Host \"Processing application: $AppName\" -ForegroundColor Cyan\n Write-Host \"===============================\"\n\n Start-Transcript -Path \"C:\\ProgramData\\Microsoft\\IntuneManagementExtension\\Logs\\$($AppName)_Uninstallation.txt\"\n\n foreach ($User in $DirectoryUsers) {\n $UserPaths = @(\n \"C:\\Users\\$User\\AppData\\Local\\$AppName*\",\n \"C:\\Users\\$User\\AppData\\LocalLow\\$AppName*\",\n \"C:\\Users\\$User\\AppData\\Roaming\\$AppName*\",\n \"C:\\Users\\$User\\AppData\\Local\\Programs\\$AppName*\",\n \"C:\\Users\\$User\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\$AppName*\",\n \"C:\\Users\\$User\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\$AppName*\",\n \"C:\\Users\\$User\\OneDrive - <COMPANY_NAME>\\Desktop\\$AppName*\"\n )\n\n foreach ($Path in $UserPaths) {\n if (Test-Path $Path) {\n Write-Host \"Found $AppName at $Path under user $User\"\n\n if ($AppName -like \"Docker*\") {\n Stop-Process -Name \"*docker*\" -Force -ErrorAction SilentlyContinue\n Write-Host \"Stopped Docker-related processes\"\n } \n elseif ($AppName -like \"Dropbox*\") {\n Stop-Process -Name \"DbxSvc*\" -Force -ErrorAction SilentlyContinue\n Write-Host \"Stopped Dropbox-related processes\"\n }\n elseif ($AppName -like \"OpenVPN*\") {\n Stop-Process -Name \"*ovpn*\" -Force -ErrorAction SilentlyContinue\n Write-Host \"Stopped OpenVPN-related processes\"\n } \n else {\n Stop-Process -Name $AppName -Force -ErrorAction SilentlyContinue\n }\n\n Remove-Item -Path $Path -Recurse -Force -Verbose\n }\n }\n }\n\n foreach ($Path in $ProgramPaths) {\n $FullPath = Join-Path $Path \"$AppName*\"\n if (Test-Path $FullPath) {\n Write-Host \"Found $AppName at $FullPath\"\n\n if ($AppName -like \"Docker*\") {\n Stop-Process -Name \"*docker*\" -Force -ErrorAction SilentlyContinue\n Write-Host \"Stopped Docker-related processes\"\n }\n elseif ($AppName -like \"Dropbox*\") {\n Stop-Process -Name \"DbxSvc*\" -Force -ErrorAction SilentlyContinue\n Write-Host \"Stopped Dropbox-related processes\"\n }\n elseif ($AppName -like \"OpenVPN*\") {\n Stop-Process -Name \"*ovpn*\" -Force -ErrorAction SilentlyContinue\n Write-Host \"Stopped OpenVPN-related processes\"\n }\n elseif ($AppName -like \"Lingoes*\") {\n Stop-Process -Name \"Lingoes*\" -Force -ErrorAction SilentlyContinue\n Write-Host \"Stopped OpenVPN-related processes\"\n } \n else {\n Stop-Process -Name $AppName -Force -ErrorAction SilentlyContinue\n }\n\n Remove-Item -Path $FullPath -Recurse -Force -Verbose\n }\n }\n\n foreach ($HKUser in $HKUsers) {\n $AppPath = \"HKU:\\$HKUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*\"\n $AppKey = Get-ItemProperty $AppPath -ea SilentlyContinue | Where-Object {$_.DisplayName -match \"$AppName\"}\n foreach ($Key in $AppKey) {\n Write-Host \"Found registry key for $AppName under HKU:\\$HKUser\"\n Remove-Item -Path $Key.PSPath -Recurse -Force -Verbose\n }\n }\n\n foreach ($Key in $HKLM + $HKCU) {\n $AppPath = \"$Key\\*\"\n $AppKey = Get-ItemProperty $AppPath -ea SilentlyContinue | Where-Object {$_.DisplayName -match \"$AppName\" -or $_.ProductName -match \"$AppName\"}\n foreach ($KeyItem in $AppKey) {\n Write-Host \"Found registry key for $AppName under $Key\"\n Remove-Item -Path $KeyItem.PSPath -Recurse -Force -Verbose\n }\n }\n\n Stop-Transcript\n}\n ",
          "description": "Add the App_Name to Full script Uninstall apps",
          "runtimeConfiguration": {
            "secureData": {
              "properties": [
                "inputs"
              ]
            }
          }
        }
      }
    }
  },
  "schemaVersion": "1.0.0.0"
}

```

## Bước 8-9: Script uninstall dùng chung và deploy qua Intune

### Thiết kế script "zero-config"

Lúc đầu mình phải khai báo `ProcessMap` và `ServiceMap` cho từng app. Cách đó không chạy được với automation, vì danh sách app thay đổi mỗi tháng. Bản hiện tại chỉ có **một chỗ duy nhất cần sửa** là `$AppNameList`. Phần còn lại script tự tìm:

1. Đọc registry Uninstall (64-bit, 32-bit và hive của từng user) để lấy `InstallLocation`, `UninstallString`, `DisplayIcon` → ra **thư mục cài đặt thật**.
2. Kill process có `.Path` nằm trong thư mục đó, không đoán theo tên.
3. Stop và xóa service có `PathName` trỏ vào thư mục đó.
4. Chạy uninstaller thật: MSI dùng `msiexec /x {ProductCode}`, EXE dùng `QuietUninstallString` hoặc tham số silent phù hợp.
5. Dọn thư mục còn sót, nhưng chỉ khi qua được hàm kiểm tra an toàn.
6. Verify lại registry và thư mục, trả exit code cho Intune.

### Script Uninstall apps của mình


```powershell
###################################################################
# Universal Application Cleanup Script - AUTO-DISCOVER
# Chi can them ten app vao $AppNameList
# Run as SYSTEM, 64-bit PowerShell
###################################################################
# ================= SAFETY SWITCHES =================
$DryRun        = $false    # TRUE = log only, DO NOT delete. Set to $false after testing OK.
$MinNameLength = 4        # App name (with '*' stripped) must be >= 4 chars -> prevents accidental deletion.

# DryRun suffix (PS 5.1 - do not use ternary operator)
$DryTag = ''
if ($DryRun) { $DryTag = ' (DRYRUN)' }

# ================= INPUT: EDIT ONLY HERE =================
$AppNameList = @(
    "*Anki*",
    "*DeskRest*",
    "*FileZilla*",
    "*Adobe Creative Cloud*"
)
# ============================================================

# ================= LOG SETUP =================
$TimeStamp = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
$LogDir    = "C:\ProgramData\Microsoft\IntuneManagementExtension\Logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$LogFile   = Join-Path $LogDir "App_Cleanup_AutoDiscover_$TimeStamp.log"
Start-Transcript -Path $LogFile -Force

Write-Host "===== App Cleanup (AUTO-DISCOVER v2) Started ====="
Write-Host "Timestamp : $(Get-Date)"
Write-Host "Host      : $env:COMPUTERNAME"
Write-Host "RunAsUser : $([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)"
Write-Host "PS Ver    : $($PSVersionTable.PSVersion)"
Write-Host "Is64bit   : $([Environment]::Is64BitProcess)   (MUST BE True)"
Write-Host "DryRun    : $DryRun"
Write-Host "=================================================="

if (-not [Environment]::Is64BitProcess -and [Environment]::Is64BitOperatingSystem) {
    Write-Host "[FATAL] Running 32-bit on a 64-bit OS -> registry is redirected, 64-bit apps will be MISSED."
    Write-Host "        Re-run using the sysnative host (see README at end of file). STOPPING."
    Stop-Transcript
    exit 1
}

# ================= STATIC CONFIG =================
$ProgramPaths = @("C:\Program Files","C:\Program Files (x86)","C:\ProgramData")

$RegistryUninstallPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKCU:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\Classes\Installer",
    "HKLM:\SOFTWARE"
)

# Folders that must NEVER be treated as an "app folder"
$ProtectedPaths = @(
    "$env:SystemRoot",
    "$env:SystemRoot\System32",
    "$env:SystemRoot\SysWOW64",
    "$env:ProgramData\Microsoft",
    "$env:ProgramData\Packages",
    "$env:ProgramData\USOShared",
    "${env:ProgramFiles}\Common Files",
    "${env:ProgramFiles(x86)}\Common Files",
    "${env:ProgramFiles}\WindowsApps",
    "${env:ProgramFiles}\Windows Defender",
    "$env:SystemDrive\Users\Default",
    "$env:SystemDrive\Users\Public\Desktop",
    "$env:SystemDrive\Recovery"
) | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\') }

# "Root" folders that must not be returned as an InstallLocation (too broad)
$RootBlacklist = @(
    "C:\", "C:\Program Files", "C:\Program Files (x86)",
    "C:\ProgramData", "C:\Windows", "C:\Users"
) | ForEach-Object { $_.TrimEnd('\') }

# ================= HELPERS =================

function Test-SafeToDelete {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    $full = $Path
    try { $full = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path } catch {}
    $full = $full.TrimEnd('\')
    if ($full -match '^[A-Za-z]:\\?$') { Write-Host "[GUARD] ROOT: $full"; return $false }
    $depth = ($full -split '\\').Where({ $_ -ne '' }).Count
    if ($depth -lt 3) { Write-Host "[GUARD] Path too shallow: $full"; return $false }
    foreach ($pp in $ProtectedPaths) {
        if ($full -ieq $pp -or $full -like "$pp\*") { Write-Host "[GUARD] PROTECTED: $full"; return $false }
    }
    return $true
}

function Test-ValidAppFolder {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    $p = $Path.TrimEnd('\')
    if ($RootBlacklist -contains $p) { return $false }
    if (-not (Test-SafeToDelete -Path $p)) { return $false }
    return $true
}

function Remove-ItemSafe {
    param([string]$Path, [string]$Tag = "")
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    if (-not (Test-SafeToDelete -Path $Path)) { return $false }
    if ($DryRun) { Write-Host "[DRYRUN]$Tag Would remove: $Path"; return $true }
    try { Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop; Write-Host "[REMOVED]$Tag $Path"; return $true }
    catch { Write-Host "[WARN]$Tag Cannot remove $Path : $_"; return $false }
}

function Remove-RegKeySafe {
    param([string]$PSPath, [string]$Tag = "")
    if ($DryRun) { Write-Host "[DRYRUN]$Tag Would remove REG: $PSPath"; return }
    Remove-Item -LiteralPath $PSPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[REMOVED]$Tag $PSPath"
}

# HKU setup
if (-not (Get-PSDrive -Name HKU -ErrorAction SilentlyContinue)) {
    New-PSDrive -PSProvider Registry -Name HKU -Root HKEY_USERS -ErrorAction SilentlyContinue | Out-Null
}
$DirectoryUsers = Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch "^(Public|Default|Default User|All Users)$" } |
    Select-Object -ExpandProperty Name

# Load offline hives
$LoadedHives = @()
foreach ($User in $DirectoryUsers) {
    $NtUser = "C:\Users\$User\NTUSER.DAT"
    if ((Test-Path $NtUser) -and -not (Test-Path "HKU:\TMP_$User")) {
        $null = reg load "HKU\TMP_$User" $NtUser 2>$null
        if ($LASTEXITCODE -eq 0) { $LoadedHives += "TMP_$User"; Write-Host "[HIVE] Loaded: $User" }
    }
}
$HKUsers = Get-ChildItem "HKU:\" -ErrorAction SilentlyContinue |
    ForEach-Object { $_.PSChildName } |
    Where-Object { $_ -match "^S-1-5-21-" -or $_ -match "^TMP_" }

# ---- CORE function: app name -> list of real install folders ----
function Get-AppInstallFolders {
    param([string]$AppName)
    $folders = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::OrdinalIgnoreCase)

    $roots = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    )
    foreach ($SID in $HKUsers) {
        $roots += "HKU:\$SID\Software\Microsoft\Windows\CurrentVersion\Uninstall"
        $roots += "HKU:\$SID\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    }

    foreach ($root in $roots) {
        Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
            $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
            if ($p.DisplayName -like $AppName) {
                if ($p.InstallLocation -and (Test-Path $p.InstallLocation)) {
                    [void]$folders.Add($p.InstallLocation.TrimEnd('\'))
                }
                if ($p.DisplayIcon) {
                    $icon = ($p.DisplayIcon -split ',')[0].Trim('"')
                    if ($icon -match '\.exe$' -and (Test-Path $icon)) {
                        [void]$folders.Add((Split-Path $icon -Parent).TrimEnd('\'))
                    }
                }
                foreach ($us in @($p.UninstallString, $p.QuietUninstallString)) {
                    if ($us) {
                        $exe = [regex]::Match($us, '["]?([A-Za-z]:\\[^"]+?\.exe)').Groups[1].Value
                        if ($exe -and (Test-Path $exe) -and $exe -notmatch 'msiexec') {
                            [void]$folders.Add((Split-Path $exe -Parent).TrimEnd('\'))
                        }
                    }
                }
            }
        }
    }

    $result = @()
    foreach ($f in $folders) { if (Test-ValidAppFolder -Path $f) { $result += $f } }
    return ($result | Select-Object -Unique)
}

function Invoke-Uninstaller {
    param([string]$AppName)
    $ran = $false
    $roots = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    )
    foreach ($SID in $HKUsers) {
        $roots += "HKU:\$SID\Software\Microsoft\Windows\CurrentVersion\Uninstall"
        $roots += "HKU:\$SID\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    }
    foreach ($root in $roots) {
        Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
            $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
            if ($p.DisplayName -like $AppName) {
                $unqs = $p.QuietUninstallString; $uns = $p.UninstallString
                if ($DryRun) {
                    Write-Host "[DRYRUN][UNINSTALL] $($p.DisplayName)"; $ran = $true; return
                }
                try {
                    if ($unqs) { Write-Host "[UNINSTALL] Quiet: $unqs"; cmd.exe /c "$unqs" 2>$null; $ran=$true }
                    elseif ($uns -match "msiexec") {
                        $guid = [regex]::Match($uns, "\{[0-9A-Fa-f\-]{36}\}").Value
                        if ($guid) { Write-Host "[UNINSTALL] MSI: $guid"; Start-Process msiexec.exe -ArgumentList "/x $guid /qn /norestart" -Wait -EA SilentlyContinue; $ran=$true }
                    }
                    elseif ($uns -match "unins\d+\.exe") {
                        $exe = [regex]::Match($uns, '["]?(.+?unins\d+\.exe)["]?').Groups[1].Value
                        if (Test-Path $exe) { Write-Host "[UNINSTALL] Inno: $exe"; Start-Process $exe -ArgumentList "/VERYSILENT /NORESTART /SUPPRESSMSGBOXES" -Wait -EA SilentlyContinue; $ran=$true }
                    }
                    elseif ($uns) { Write-Host "[UNINSTALL] Generic: $uns /S"; cmd.exe /c "$uns /S" 2>$null; $ran=$true }
                } catch { Write-Host "[WARN] Uninstaller error: $_" }
            }
        }
    }
    return $ran
}

function Clear-RecycleMatch {
    param([string]$AppName)
    $hit = $false
    Get-ChildItem "C:\`$Recycle.Bin" -Recurse -Force -EA SilentlyContinue |
        Where-Object { $_.Name -like $AppName } |
        ForEach-Object { if (Remove-ItemSafe -Path $_.FullName -Tag "[RECYCLEBIN]") { $hit = $true } }
    return $hit
}

# ================= MAIN =================
foreach ($AppName in $AppNameList) {

    $Clean = ($AppName -replace '\*','').Trim()
    if ([string]::IsNullOrWhiteSpace($Clean) -or $Clean.Length -lt $MinNameLength) {
        Write-Host "`n[SKIP][GUARD] '$AppName' -> name too short/empty (must be >= $MinNameLength). Skipping."
        continue
    }

    Write-Host "`n>>> Processing: $AppName"
    Write-Host "---------------------------------------"
    $Found = $false; $Removed = $false

    # ---------- 0. AUTO-DISCOVER the real install folders ----------
    $AppFolders = @(Get-AppInstallFolders -AppName $AppName)
    if ($AppFolders.Count) {
        Write-Host "[DISCOVER] Install folders:"
        $AppFolders | ForEach-Object { Write-Host "   - $_" }
    } else {
        Write-Host "[DISCOVER] No InstallLocation found (app may be portable / partially uninstalled)."
    }

    # ---------- 1. KILL PROCESS ----------
    # 1a. Prefer matching by .Path inside the app folder (accurate)
    $killedByPath = $false
    if ($AppFolders.Count) {
        Get-Process -EA SilentlyContinue | ForEach-Object {
            $proc = $_
            $pPath = $null
            try { $pPath = $proc.Path } catch { $pPath = $null }  # protected process -> skip
            if ($pPath) {
                foreach ($f in $AppFolders) {
                    if ($pPath -like "$f\*") {
                        Write-Host "[KILL] $($proc.Name) (PID $($proc.Id)) -> $pPath"
                        if (-not $DryRun) { Stop-Process -Id $proc.Id -Force -EA SilentlyContinue }
                        $Found = $true; $killedByPath = $true; break
                    }
                }
            }
        }
    }
    # 1b. Fallback by name ONLY when no folder was discovered (avoids false matches)
    if (-not $AppFolders.Count) {
        Get-Process -EA SilentlyContinue | Where-Object { $_.Name -like "$Clean*" } | ForEach-Object {
            Write-Host "[KILL][NAME] $($_.Name)"
            if (-not $DryRun) { Stop-Process -Id $_.Id -Force -EA SilentlyContinue }
            $Found = $true
        }
    }

    # ---------- 2. STOP + DELETE SERVICE ----------
    Get-CimInstance Win32_Service -EA SilentlyContinue | ForEach-Object {
        $svc = $_; $match = $false
        if ($svc.PathName) {
            # Extract the first exe path from PathName, then prefix-compare with the app folder
            $svcExe = [regex]::Match($svc.PathName, '["]?([A-Za-z]:\\[^"]+?\.exe)').Groups[1].Value
            foreach ($f in $AppFolders) {
                if ($svcExe -and ($svcExe -like "$f\*")) { $match = $true; break }
            }
        }
        if (-not $match -and $svc.DisplayName -like $AppName) { $match = $true }
        if ($match) {
            Write-Host "[SERVICE] $($svc.Name) -> $($svc.PathName)"
            if (-not $DryRun) {
                Stop-Service $svc.Name -Force -EA SilentlyContinue
                sc.exe delete $svc.Name | Out-Null
            }
            $Found = $true; $Removed = $true
        }
    }

    # ---------- 3. RUN THE ACTUAL UNINSTALLER ----------
    if (Invoke-Uninstaller -AppName $AppName) { $Found = $true; $Removed = $true }

    # ---------- 4. DELETE INSTALL FOLDER (auto-discovered) ----------
    foreach ($f in $AppFolders) {
        if (Test-Path $f) { if (Remove-ItemSafe -Path $f -Tag "[APPDIR]") { $Found=$true; $Removed=$true } }
    }

    # ---------- 5. DELETE FILES: USER APPDATA ----------
    foreach ($User in $DirectoryUsers) {
        $UserPaths = @(
            "C:\Users\$User\AppData\Local\$Clean",
            "C:\Users\$User\AppData\LocalLow\$Clean",
            "C:\Users\$User\AppData\Roaming\$Clean",
            "C:\Users\$User\AppData\Local\Programs\$Clean"
        )
        foreach ($Path in $UserPaths) {
            if (Test-Path $Path) { if (Remove-ItemSafe -Path $Path -Tag "[USER:$User]") { $Found=$true; $Removed=$true } }
        }
        Get-ChildItem "C:\Users\$User\AppData\Roaming\Microsoft\Windows\Recent",`
                      "C:\Users\$User\Desktop" -Filter *.lnk -Recurse -Force -EA SilentlyContinue |
            Where-Object { $_.Name -like $AppName } |
            ForEach-Object { if (Remove-ItemSafe -Path $_.FullName -Tag "[LNK:$User]") { $Found=$true; $Removed=$true } }
    }

    # ---------- 6. DELETE FILES: SYSTEM PATHS (by name, guarded) ----------
    foreach ($Base in $ProgramPaths) {
        Get-ChildItem $Base -Directory -Force -EA SilentlyContinue |
            Where-Object { $_.Name -like $AppName } |
            ForEach-Object { if (Remove-ItemSafe -Path $_.FullName -Tag "[SYSTEM]") { $Found=$true; $Removed=$true } }
    }
    Get-ChildItem "C:\ProgramData\Microsoft\Windows\Start Menu\Programs",`
                  "C:\Users\Public\Desktop" -Filter *.lnk -Recurse -Force -EA SilentlyContinue |
        Where-Object { $_.Name -like $AppName } |
        ForEach-Object { if (Remove-ItemSafe -Path $_.FullName -Tag "[LNK][PUBLIC]") { $Found=$true; $Removed=$true } }

    # ---------- 7. REGISTRY UNINSTALL (HKLM/HKCU) by DisplayName ----------
    foreach ($Reg in $RegistryUninstallPaths) {
        Get-ChildItem $Reg -EA SilentlyContinue | ForEach-Object {
            $p = Get-ItemProperty $_.PSPath -EA SilentlyContinue
            if ($p.DisplayName -like $AppName) {
                Write-Host "[FOUND][REG] $($p.DisplayName)"
                Remove-RegKeySafe -PSPath $_.PSPath -Tag "[REG]"; $Found=$true; $Removed=$true
            }
        }
    }

    # ---------- 8. REGISTRY UNINSTALL (HKU + offline hives) ----------
    foreach ($SID in $HKUsers) {
        foreach ($sub in @("Software\Microsoft\Windows\CurrentVersion\Uninstall",
                            "Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall")) {
            Get-ChildItem "HKU:\$SID\$sub" -EA SilentlyContinue | ForEach-Object {
                $p = Get-ItemProperty $_.PSPath -EA SilentlyContinue
                if ($p.DisplayName -like $AppName) {
                    Write-Host "[FOUND][REG][SID:$SID] $($p.DisplayName)"
                    Remove-RegKeySafe -PSPath $_.PSPath -Tag "[REG][SID:$SID]"; $Found=$true; $Removed=$true
                }
            }
        }
    }

    # ---------- 9. MSI Installer\Products ----------
    Get-ChildItem "HKLM:\SOFTWARE\Classes\Installer\Products" -EA SilentlyContinue | ForEach-Object {
        $p = Get-ItemProperty $_.PSPath -EA SilentlyContinue
        if ($p.ProductName -like $AppName) {
            Write-Host "[FOUND][MSI] $($p.ProductName)"
            Remove-RegKeySafe -PSPath $_.PSPath -Tag "[MSI]"; $Found=$true; $Removed=$true
        }
    }

    # ---------- 10. App Paths ----------
    foreach ($ap in @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",
                      "HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\App Paths")) {
        Get-ChildItem $ap -EA SilentlyContinue | Where-Object { $_.PSChildName -like $AppName } |
            ForEach-Object { Write-Host "[FOUND][APPPATH] $($_.PSChildName)"; Remove-RegKeySafe -PSPath $_.PSPath -Tag "[APPPATH]"; $Found=$true; $Removed=$true }
    }

    # ---------- 11. PREFETCH ----------
    $pfName = ($AppName -replace '[\*\s]','')
    Get-ChildItem "C:\Windows\Prefetch" -Filter "*.pf" -EA SilentlyContinue |
        Where-Object { $_.Name -like "*$pfName*" } |
        ForEach-Object {
            if ($DryRun) { Write-Host "[DRYRUN][PREFETCH] $($_.Name)" }
            else { Remove-Item $_.FullName -Force -EA SilentlyContinue; Write-Host "[REMOVED][PREFETCH] $($_.Name)" }
        }

    # ---------- RESULT ----------
    if (-not $Found)  { Write-Host "[RESULT][NOT FOUND] $AppName" }
    elseif ($Removed) { Write-Host "[RESULT][SUCCESS] $AppName cleaned$DryTag" }
    else              { Write-Host "[RESULT][PARTIAL] $AppName detected but not fully removed" }
}

# ================= UNLOAD OFFLINE HIVES =================
[gc]::Collect(); Start-Sleep -Seconds 2
foreach ($h in $LoadedHives) { $null = reg unload "HKU\$h" 2>$null; Write-Host "[HIVE] Unloaded $h" }

Write-Host "`n===== Cleanup Completed$DryTag ====="
Write-Host "Log: $LogFile"
Start-Sleep -Seconds 3
Stop-Transcript

# Exit code for Intune (0 = success)
exit 0
```

### Power Automate đưa tên app vào script

Flow thay khối `$AppNameList` trong file template bằng danh sách đã duyệt, rồi lưu thành file `.ps1` mới trên SharePoint:

```powershell
$AppNameList = @(
    "Telegram Desktop*",
    "Viber*",
    "FileZilla Client*"
    # Power Automate sinh danh sách ở đây
)
```

### Đóng gói và upload lên Intune

```powershell
# Đóng gói .intunewin
.\IntuneWinAppUtil.exe -c "C:\Packages\AppCleanup" -s "App_Cleanup.ps1" -o "C:\Packages\Output" -q
```

Cấu hình Win32 app:

| Mục | Giá trị |
|---|---|
| Install command | `%windir%\sysnative\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\App_Cleanup.ps1` |
| Install behavior | System |
| Return codes | `0` Success, `3010` Soft reboot, `1` Failed |
| Detection | Script kiểm tra không còn app nào trong `$AppNameList` trong registry Uninstall |
| Assignment | Required, cho nhóm thiết bị cần gỡ |


### Script Detection rule của mình

```powershell
# Detection script - exit 0 + STDOUT khi không còn app nào trong danh sách
$AppFound = $false

# ---------- APP LIST ----------
$AppNameList = @(
    "*Anki*",
    "*DeskRest*",
    "*FileZilla*",
    "*Adobe Creative Cloud*"
)

# ---------- ENSURE HKU ----------
if (-not (Get-PSDrive -Name HKU -ErrorAction SilentlyContinue)) {
    New-PSDrive -PSProvider Registry -Name HKU -Root HKEY_USERS | Out-Null
}

# ==== USERS ====
$DirectoryUsers = Get-ChildItem "C:\Users" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch "^(Public|Default|Default User|All Users)$" } |
    Select-Object -ExpandProperty Name

# ==== LOGGING ====
$SaveDate = (Get-Date).ToString("dd.MM.yyyy-HH.mm.ss")
$LogPath  = "C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\Detect_Apps_T9-2026_$SaveDate.txt"

try {
    Start-Transcript -Path $LogPath -Force

    foreach ($AppName in $AppNameList) {

        Write-Host "---------------------------------------"
        Write-Host "Checking application: $AppName"
        Write-Host "---------------------------------------"

        $UseWildcard = $AppName -like "*`*"

        # ==== USER PATH CHECK ====
        foreach ($User in $DirectoryUsers) {

            $UserPaths = @(
                "C:\Users\$User\AppData\Local\$AppName",
                "C:\Users\$User\AppData\LocalLow\$AppName",
                "C:\Users\$User\AppData\Roaming\$AppName",
                "C:\Users\$User\AppData\Local\Programs\$AppName",
                "C:\Users\$User\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\$AppName",
                "C:\Users\Public\Desktop\$AppName"
            )

            foreach ($Path in $UserPaths) {
                if (Test-Path $Path) {
                    Write-Host "Detected: $AppName at $Path"
                    $AppFound = $true
                    break
                }
            }

            if ($AppFound) { break }
        }

        if ($AppFound) { break }

        # ==== REGISTRY CHECK ====
        $RegistryPaths = @(
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            "HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            "HKCU:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
        )

        foreach ($RegPath in $RegistryPaths) {

            Get-ItemProperty "$RegPath\*" -ErrorAction SilentlyContinue |
                Where-Object {
                    if ($UseWildcard) {
                        $_.DisplayName -and $_.DisplayName -like $AppName
                    } else {
                        $_.DisplayName -eq $AppName
                    }
                } |
                ForEach-Object {
                    Write-Host "Detected: $AppName in registry at $($_.PSPath)"
                    $AppFound = $true
                }

            if ($AppFound) { break }
        }

        if ($AppFound) { break }

        # ==== SYSTEM PATH CHECK ====
        $SystemPaths = @(
            "C:\Program Files\$AppName",
            "C:\Program Files (x86)\$AppName",
            "C:\ProgramData\$AppName",
            "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\$AppName"
        )

        foreach ($SysPath in $SystemPaths) {
            if (Test-Path $SysPath) {
                Write-Host "Detected: $AppName at $SysPath"
                $AppFound = $true
                break
            }
        }

        if ($AppFound) { break }
    }

}
finally {
    
}

Write-Host "---------------------------------------"

if ($AppFound) {
    Write-Host "At least one application was detected."
    exit 1   # Non-compliant
} else {
    Write-Host "No applications were detected."
    exit 0   # Compliant
}
Stop-Transcript | Out-Null
```

Nếu muốn tự động luôn bước upload, có thể dùng module cộng đồng `IntuneWin32App` (`Add-IntuneWin32App`) hoặc Microsoft Graph. Mình vẫn để bước upload là **thao tác có người duyệt**, vì đây là điểm cuối cùng trước khi script chạy trên máy thật.

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Luôn chạy script với <code>$DryRun = $true</code> trên 5-10 máy pilot và đọc log trước khi gỡ thật. Một wildcard sai như <code>*LINE*</code> hay <code>Hyper</code> có thể khớp với <code>Online</code>, <code>Baseline</code> hay <code>Hyper-V</code> và xóa nhầm thành phần hệ thống trên hàng nghìn máy.</div>
</div>

## Bước 10: Thêm app vào AppLocker để chặn cài lại

Gỡ xong mà không chặn thì sớm muộn user cũng cài lại. Mình thêm **Publisher Deny rule** cho mỗi app đã gỡ. Môi trường của mình có hai kênh:

- **Máy domain (GPO):** GitLab pipeline đọc file Excel chứa rule, validate, rồi apply vào GPO AppLocker.
- **Máy chỉ quản lý bằng Intune:** cập nhật XML trong profile Custom OMA-URI `./Vendor/MSFT/AppLocker/ApplicationLaunchRestrictions/...`.

### Thông tin một rule

| Trường | Ví dụ |
|---|---|
| Name | Block Logseq |
| PublisherName | `O=LOGSEQ, INC., L=NEW YORK, S=NEW YORK, C=US` |
| ProductName | `LOGSEQ` |
| BinaryName | `*` |
| Action | Deny |
| Type | Exe |
| UserOrGroupSid | SID của nhóm áp dụng |
| Description | Mã ticket + lý do |

Lấy thông tin Publisher từ file exe trên một máy còn app:

```powershell
Get-AppLockerFileInformation -Path "C:\Path\To\App.exe" | Select-Object -ExpandProperty Publisher
```

### Pipeline của mình


```yaml
# .gitlab-ci.yml - AppLocker rule automation (validate -> dry-run -> apply)

```

```powershell
# Apply-AppLockerRules.ps1
# Đọc Excel -> validate -> backup policy -> add/update rule -> verify

```

Khi ghi vào GPO, mình đọc toàn bộ policy hiện tại, sửa đúng các rule cần thay đổi rồi ghi lại bằng `Set-AppLockerPolicy -Ldap`. Pipeline luôn **backup policy trước khi ghi** và không xóa các rule không nằm trong file input.

### Kiểm tra AppLocker đã có hiệu lực trên máy

```powershell
# Service bắt buộc phải chạy
Get-Service AppIDSvc

# Policy từ Intune (CSP) đã xuống máy chưa
Get-CimClass -Namespace root\cimv2\mdm\dmmap | Where-Object CimClassName -match 'AppLocker' | Select-Object CimClassName

# Policy hiệu lực (GPO)
Get-AppLockerPolicy -Effective -Xml | Select-String 'Logseq'

# Event 8004 = đã chặn, 8002 = cho phép, 8003 = audit
Get-WinEvent -LogName 'Microsoft-Windows-AppLocker/EXE and DLL' -MaxEvents 200 | Where-Object Id -eq 8004 | Select-Object TimeCreated, Message
```

## Bước 11: Theo dõi tỷ lệ gỡ thành công

Chạy script xong chưa phải là xong. Mình theo dõi ít nhất **hai chu kỳ quét** tiếp theo của SentinelOne:

| Chỉ số | Cách tính |
|---|---|
| Tổng số lượt cần gỡ | Số cặp app + máy trong danh sách Uninstall |
| Gỡ thành công | Cặp app + máy không còn xuất hiện ở lần quét sau |
| Tỷ lệ thành công | Thành công / Tổng |
| Còn sót | Nhóm theo app để tìm app mà script chưa xử lý được |

Ví dụ: 100 lượt gỡ trên 50 máy, sau lần quét đầu còn 12 lượt sót, và 9 trong số đó là cùng một app portable. Đó là tín hiệu cần bổ sung xử lý cho app đó, chứ không phải chạy lại cả script.

## Những lỗi mình đã gặp

| Lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| Script không gỡ được gì | Log báo không tìm thấy app nào | Dùng `-eq "7-Zip*"`, mà `-eq` không hiểu wildcard | Dùng `-like` |
| Script crash ngay khi deploy | Intune báo Failed, log trống | Dùng toán tử `? :` (chỉ có từ PowerShell 7), nhưng Intune chạy Windows PowerShell 5.1 | Thay bằng `if/else` |
| Bỏ sót app 64-bit | Máy còn app nhưng script báo không có | Intune chạy PowerShell 32-bit, registry bị chuyển sang `WOW6432Node` | Gọi PowerShell qua `sysnative`, script tự thoát nếu chạy 32-bit |
| User mất taskbar | Explorer bị tắt sau khi gỡ app có menu chuột phải | Restart Manager tắt `explorer.exe` để giải phóng shell extension và không mở lại | Thêm `MSIRESTARTMANAGERCONTROL=Disable REBOOT=ReallySuppress` cho `msiexec` |
| Script treo đến khi Intune timeout | Log dừng ở dòng "Installer type: MSI" | Uninstaller hiện prompt ẩn trong Session 0, hoặc đang có MSI khác chạy | Đặt timeout cho mọi tiến trình, kiểm tra `_MSIExecute` trước khi chạy |
| Khớp nhầm tên ngắn | `Hyper` khớp `Hyper-V`, `bat` khớp `Battery` | So khớp substring | So khớp anchored: đúng tên, hoặc tên + khoảng trắng / dấu ngoặc / dấu gạch |
| Driver không gỡ được | STMicroelectronics, PL23XX vẫn còn | Tên trong registry có chèn thêm chuỗi khác, driver nằm trong DriverStore | Dùng `pnputil /delete-driver oemXX.inf /uninstall`, không xóa DriverStore bằng tay |
| App portable vẫn bị quét ra | Rclone, Pandoc, uv... còn trong inventory | Không có registry Uninstall | Dọn theo thư mục đã biết, chỉ báo cáo (không tự xóa) file tìm thấy khi quét toàn ổ |

Ba nguyên tắc an toàn mình rút ra:

- **Không xóa trực tiếp registry `Installer\Products`** của MSI. Hãy để `msiexec /x` tự dọn, nếu không Windows Installer sẽ hỏng khả năng repair và update.
- **Không quét toàn ổ đĩa rồi xóa theo tên.** Có một danh sách thư mục được bảo vệ (`C:\Windows`, `System32`, `ProgramData\Microsoft`, `Common Files`, `WindowsApps`, thư mục gốc của ổ) và chặn mọi đường dẫn quá nông.
- **Lấy `DisplayName` đầy đủ** từ inventory thay vì gõ tay. Tên càng chính xác, wildcard càng ít, rủi ro càng thấp.

## Kết luận

Gỡ phần mềm không được phép không khó. Cái khó là làm đều đặn, có bằng chứng và không để tái diễn. Khi ghép SentinelOne, Power BI, Power Automate, Intune và AppLocker thành một chuỗi, IT chỉ còn hai việc là duyệt danh sách và đọc báo cáo. Nếu bạn muốn bắt đầu, hãy làm bước so sánh với Software Catalog trước. Chỉ riêng bước này đã tiết kiệm cho License Team nhiều giờ mỗi tháng.

Bạn đang quản lý phần mềm ngoài danh mục ở công ty mình theo cách nào: chặn trước, gỡ sau, hay cả hai?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
